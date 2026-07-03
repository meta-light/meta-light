import { Client, GatewayIntentBits, SlashCommandBuilder, TextChannel, EmbedBuilder, Guild, ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import dotenv from 'dotenv';
import { DISCORD_BOT_TOKEN } from '../../env';
import { getChainConfigs } from '../../services/trading/index-old';
import { TradingConfig } from '../../services/trading/config';
import { CombinedPerformanceData } from '../../services/trading/models/interfaces';
dotenv.config();

export interface DiscordConfig {token: string; channelId: string; guildId: string; intents?: GatewayIntentBits[];}
export interface MessageOptions {content?: string; embeds?: EmbedBuilder[];}
export interface InteractionReplyOptions extends MessageOptions {ephemeral?: boolean;}

export class DiscordUtils {
    static createEmbed(title: string, color: number = 0x0099FF, footerText: string = 'CarpCap Bot'): EmbedBuilder {
        return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp().setFooter({ text: footerText });
    }
    static isTextChannel(channel: any): channel is TextChannel {return channel && channel.isTextBased();}
    static formatError(error: any): string {
        if (error.code === 50001) {return '[discord]: Bot missing permissions to send messages in channel.';} 
        else if (error.code === 50013) {return '[discord]: Bot missing permissions to send embeds.';}
        return `[discord]: An error occurred: ${error.message || 'Unknown error'}`;
    }
    static createSlashCommand(name: string, description: string): SlashCommandBuilder {return new SlashCommandBuilder().setName(name).setDescription(description);}
}

export class DiscordManager {
    private client: Client;
    private config: DiscordConfig;
    private isReady: boolean = false;
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    constructor(config: DiscordConfig) {
        this.config = config;
        const intents = config.intents || [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        this.client = new Client({ intents });
        this.setupEventHandlers();
    }
    private setupEventHandlers(): void {
        this.client.once('ready', () => {console.log(`[discord]: Bot logged in as ${this.client.user?.tag}`); this.isReady = true;});
        this.client.on('error', (error) => {console.error('[discord]: Client error:', error);});
    }
    async login(): Promise<boolean> {
        try {await this.client.login(this.config.token); return true;} 
        catch (error) {console.error('[discord]: Failed to login client:', error); return false;}
    }
    getClient(): Client {return this.client;}
    isClientReady(): boolean {return this.isReady;}
    getTextChannel(channelId?: string): TextChannel | null {
        const id = channelId || this.config.channelId;
        const channel = this.client.channels.cache.get(id);
        return DiscordUtils.isTextChannel(channel) ? channel : null;
    }
    getGuild(guildId?: string): Guild | null {const id = guildId || this.config.guildId; return this.client.guilds.cache.get(id) || null;}
    async sendMessage(options: MessageOptions, channelId?: string): Promise<boolean> {
        try {
            const channel = this.getTextChannel(channelId);
            if (!channel) {console.error(`[discord]: Channel not found: ${channelId || this.config.channelId}`); return false;}
            await channel.send(options);
            return true;
        } 
        catch (error) {console.error('[discord]: Error sending message:', DiscordUtils.formatError(error)); return false;}
    }
    async registerCommands(commands: RESTPostAPIApplicationCommandsJSONBody[], guildId?: string): Promise<boolean> {
        try {
            const guild = this.getGuild(guildId);
            if (!guild) {console.error(`[discord]: Guild not found: ${guildId || this.config.guildId}`); return false;}
            await guild.commands.set(commands);
            return true;
        } 
        catch (error) {console.error('[discord]: Error registering commands:', error); return false;}
    }
    async replyToInteraction(interaction: ChatInputCommandInteraction, options: InteractionReplyOptions): Promise<boolean> {
        try {
            if (interaction.replied || interaction.deferred) {await interaction.editReply(options);} 
            else {await interaction.reply({ ...options, ephemeral: options.ephemeral ?? false });}
            return true;
        } 
        catch (error) {console.error('[discord]: Error handling interaction reply:', error); return false;}
    }
    setInterval(name: string, callback: () => void, interval: number): void {
        this.clearInterval(name);
        const intervalId = setInterval(callback, interval);
        this.intervals.set(name, intervalId);
    }
    clearInterval(name: string): void {
        const intervalId = this.intervals.get(name);
        if (intervalId) {clearInterval(intervalId); this.intervals.delete(name);}
    }
    onInteraction(handler: (interaction: ChatInputCommandInteraction) => Promise<void>): void {
        this.client.on('interactionCreate', async (interaction) => {if (interaction.isChatInputCommand()) {await handler(interaction);}});
    }
    onReady(handler: () => Promise<void>): void {this.client.once('ready', handler);}
    cleanup(): void {for (const [name] of this.intervals) {this.clearInterval(name);} console.log('[discord]: Client cleaned up');}
    async destroy(): Promise<void> {this.cleanup(); await this.client.destroy();}
}

function gatherAllPerformanceData(): CombinedPerformanceData {
    const chainConfigs = getChainConfigs();
    let totalCombinedValue = 0;
    let totalCombinedTrades = 0;
    let isAnyActive = false;
    const chainData = chainConfigs.map(chain => {
        let performance = null;
        let isRunning = false;
        try {
            isRunning = chain.isRunning();
            if (isRunning) {
                performance = chain.getPerformance();
                if (performance && typeof performance === 'object') {
                    const portfolioValue = Math.max(0, performance.totalPortfolioValue ||  performance.portfolioValue ||  0);
                    const trades = performance.strategies?.reduce((sum: number, s: any) => {return sum + Math.max(0, s.totalTrades || 0);}, 0) || Math.max(0, performance.totalTrades || 0);
                    totalCombinedValue += portfolioValue;
                    totalCombinedTrades += trades;
                    isAnyActive = true;
                    console.log(`[${chain.name}] (${chain.mode}): Portfolio Value = $${portfolioValue.toFixed(2)}, Trades = ${trades}, Running = ${isRunning}`);
                } 
                else {console.log(`[${chain.name}] (${chain.mode}): No performance data (returned null/undefined), Running = ${isRunning}`);}
            } 
            else {console.log(`${chain.name} (${chain.mode}): Not running`);}
        } 
        catch (error) {console.log(`${chain.name} (${chain.mode}) error:`, error instanceof Error ? error.message : String(error));}
        return {name: chain.name, mode: chain.mode, performance, isRunning};
    });
    return {chains: chainData, totalCombinedValue, totalCombinedTrades, isAnyActive};
}

function buildCombinedPerformanceEmbed(combinedData: CombinedPerformanceData): EmbedBuilder {
    const { chains, totalCombinedValue, totalCombinedTrades, isAnyActive } = combinedData;
    const embed = DiscordUtils.createEmbed('Complete Trading Performance Report', 0x00AE86);
    if (!isAnyActive) {embed.addFields([{name: 'Status', value: 'No trading chains are currently active or have data.', inline: false}]); return embed;}
    const overviewText = `**Combined Portfolio Value:** $${totalCombinedValue.toFixed(2)}\n` + `**Total Combined Trades:** ${totalCombinedTrades}\n` + `**Active Chains:** ${chains.filter(c => c.isRunning).length}/${chains.length}`;
    embed.addFields([{name: 'Portfolio Overview', value: overviewText, inline: false}]);
    chains.forEach(chain => {
        const { name, mode, performance, isRunning } = chain;
        if (!isRunning || !performance) {embed.addFields([{name: `${getChainEmoji(name)} ${name} (${mode})`, value: '⚫ Inactive - Not running or no data', inline: true}]); return;}
        const totalPortfolioValue = (performance as any).totalPortfolioValue || (performance as any).portfolioValue || 0;
        const totalReturn = (performance as any).totalReturn || 0;
        const strategies = (performance as any).strategies || [];
        const totalTrades = strategies?.reduce((sum: number, s: any) => sum + Math.max(0, s.totalTrades || 0), 0) || Math.max(0, (performance as any).totalTrades || 0);
        const profitableTrades = strategies?.reduce((sum: number, s: any) => sum + Math.max(0, s.successfulTrades || 0), 0) || 0;
        const winRate = totalTrades > 0 ? Math.min(100, Math.max(0, (profitableTrades / totalTrades) * 100)) : 0;
        const config = getChainConfig(name);
        const initialBalance = config.INITIAL_BALANCE;
        const profitLoss = totalPortfolioValue - initialBalance;
        const totalRealizedPnL = strategies?.reduce((sum: number, s: any) => sum + (s.realizedPnL || 0), 0) || 0;
        const positions = (performance as any).positions || [];
        const unrealizedFallback = Array.isArray(positions) ? positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnL || 0), 0) : 0;
        const totalUnrealizedPnL = strategies?.reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0) || unrealizedFallback;
        const perfFees = (performance as any).totalFeesPaid || 0;
        const totalFeesPaid = strategies?.reduce((sum: number, s: any) => sum + (s.totalFeesPaid || 0), 0) || perfFees || 0;
        const chainText = `**Value:** $${totalPortfolioValue.toFixed(2)}\n` +
                         `**Return:** ${(totalReturn * 100).toFixed(2)}%\n` +
                         `**P&L:** ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}\n` +
                         `**Trades:** ${totalTrades} (${winRate.toFixed(1)}% win)\n` +
                         `**Realized:** ${totalRealizedPnL >= 0 ? '+' : ''}$${totalRealizedPnL.toFixed(2)} | **Unrealized:** ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)}\n` +
                         `**Fees Paid:** $${totalFeesPaid.toFixed(2)}`;
        embed.addFields([{name: `${getChainEmoji(name)} ${name} (${mode})`, value: chainText, inline: true}]);
    });
    return embed;
}

function getChainEmoji(chainName: string): string {switch (chainName) {case 'SOLANA': return '🌞'; case 'ECLIPSE': return '🌒'; default: return '🤖';}}

function getChainConfig(chainName: string) {
    switch (chainName) {
        case 'SOLANA': return {...TradingConfig, ...TradingConfig.SOLANA, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE};
        case 'ECLIPSE': return {...TradingConfig, ...TradingConfig.ECLIPSE, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE};
        default: return {...TradingConfig, ...TradingConfig.SOLANA, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE};
    }
}

export function buildAllStrategiesEmbeds(combinedData: CombinedPerformanceData): EmbedBuilder[] {
    const { chains } = combinedData;
    const embeds: EmbedBuilder[] = [];
    if (chains.length === 0 || !chains.some(c => c.isRunning)) {
        const embed = DiscordUtils.createEmbed('Chain Performance Summary', 0x00AE86);
        embed.addFields([{name: 'No Data', value: 'No trading chains are currently active or have data.', inline: false}]);
        return [embed];
    }
    const overviewEmbed = DiscordUtils.createEmbed('Trading Performance by Chain', 0x00AE86);
    let totalActiveChains = 0;
    let totalCombinedTrades = 0;
    let totalCombinedValue = 0;
    chains.forEach(chain => {
        if (chain.isRunning && chain.performance) {
            totalActiveChains++;
            const strategies = chain.performance.strategies || [];
            const chainTrades = strategies.reduce((sum: number, s: any) => sum + Math.max(0, s.totalTrades || 0), 0);
            const chainValue = Math.max(0, chain.performance.totalPortfolioValue || chain.performance.portfolioValue || 0);
            totalCombinedTrades += chainTrades;
            totalCombinedValue += chainValue;
            const totalRealizedPnL = strategies.reduce((sum: number, s: any) => sum + (s.realizedPnL || 0), 0);
            const totalUnrealizedPnL = strategies.reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0);
            const totalFeesPaid = strategies.reduce((sum: number, s: any) => sum + Math.max(0, s.totalFeesPaid || 0), 0);
            const profitableTrades = strategies.reduce((sum: number, s: any) => sum + Math.max(0, s.successfulTrades || 0), 0);
            const winRate = chainTrades > 0 ? (profitableTrades / chainTrades) * 100 : 0;
            const totalReturn = (chain.performance.totalReturn || 0) * 100;
            const chainSummary = `**Portfolio Value:** $${chainValue.toFixed(2)}\n` +
                               `**Total Return:** ${totalReturn.toFixed(2)}%\n` +
                               `**Total Trades:** ${chainTrades} (${winRate.toFixed(1)}% win)\n` +
                               `**Realized P&L:** ${totalRealizedPnL >= 0 ? '+' : ''}$${totalRealizedPnL.toFixed(2)}\n` +
                               `**Unrealized P&L:** ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)}\n` +
                               `**Fees Paid:** $${totalFeesPaid.toFixed(2)}`;
            overviewEmbed.addFields([{name: `${getChainEmoji(chain.name)} ${chain.name} (${chain.mode})`, value: chainSummary, inline: true}]);
        }
    });
    const summaryText = `**Active Chains:** ${totalActiveChains}\n` + `**Combined Value:** $${totalCombinedValue.toFixed(2)}\n` + `**Combined Trades:** ${totalCombinedTrades}`;
    overviewEmbed.addFields([{name: '📈 Overall Summary', value: summaryText, inline: false}]);
    embeds.push(overviewEmbed);
    return embeds;
}

export function startDiscordClient(channelId: string, guildId: string) {
    if (!DISCORD_BOT_TOKEN) {console.error("DISCORD_BOT_TOKEN not set in environment variables."); return { cleanup: () => {} };}
    const discordManager = new DiscordManager({token: DISCORD_BOT_TOKEN, channelId, guildId});
    async function sendPerformanceReport() {
        const combinedData = gatherAllPerformanceData();
        const combinedEmbed = buildCombinedPerformanceEmbed(combinedData);
        const success = await discordManager.sendMessage({ embeds: [combinedEmbed] });
        if (success) {console.log('[Bot] Discord manager operational');} else {console.error('[Bot] Failed to send performance report');}
    }
    discordManager.onReady(async () => {
        const commands = [
            DiscordUtils.createSlashCommand('tradingperformance', 'Get current trading bot performance'),
            DiscordUtils.createSlashCommand('tradingstatus', 'Check if trading bot is running'),
        ].map(command => command.toJSON());
        await discordManager.registerCommands(commands);
        const startupEmbed = DiscordUtils.createEmbed('🤖 CarpCap Bot Started', 0x00FF00);
        await discordManager.sendMessage({ embeds: [startupEmbed] });
        discordManager.setInterval('performanceReport', sendPerformanceReport, 8 * 60 * 60 * 1000);
        setTimeout(() => {sendPerformanceReport();}, 5000);
    });
    discordManager.onInteraction(async (interaction) => {
        const { commandName } = interaction;
        if (commandName === 'tradingperformance') {
            await discordManager.replyToInteraction(interaction, {content: 'Generating performance report...', ephemeral: true});
            try {
                const combinedData = gatherAllPerformanceData();
                if (!combinedData.isAnyActive) {await discordManager.replyToInteraction(interaction, {content: '⚠️ No trading chains are currently active or have data available.'}); return;}
                const embed = buildCombinedPerformanceEmbed(combinedData);
                await discordManager.replyToInteraction(interaction, {content: '', embeds: [embed]});
            } 
            catch (error) {
                console.error("Error getting trading performance:", error);
                await discordManager.replyToInteraction(interaction, {content: 'Failed to get performance data.'});
            }
        }
    });
    const cleanup = () => {discordManager.cleanup();};
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    discordManager.login();
    return { cleanup, sendPerformanceReport, discordManager };
}