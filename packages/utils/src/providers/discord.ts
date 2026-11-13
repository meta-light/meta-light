import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  Guild,
  ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

export interface DiscordConfig {
  token: string;
  channelId: string;
  guildId: string;
  intents?: GatewayIntentBits[];
}
export interface MessageOptions {
  content?: string;
  embeds?: EmbedBuilder[];
}
export interface InteractionReplyOptions extends MessageOptions {
  ephemeral?: boolean;
}

export class DiscordUtils {
  static createEmbed(
    title: string,
    color: number = 0x0099ff,
    footerText: string = 'CarpCap Bot',
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: footerText });
  }
  static isTextChannel(channel: any): channel is TextChannel {
    return channel && channel.isTextBased();
  }
  static formatError(error: any): string {
    if (error.code === 50001) {
      return '[discord]: Bot missing permissions to send messages in channel.';
    } else if (error.code === 50013) {
      return '[discord]: Bot missing permissions to send embeds.';
    }
    return `[discord]: An error occurred: ${error.message || 'Unknown error'}`;
  }
  static createSlashCommand(
    name: string,
    description: string,
  ): SlashCommandBuilder {
    return new SlashCommandBuilder().setName(name).setDescription(description);
  }
}

export class DiscordManager {
  private client: Client;
  private config: DiscordConfig;
  private isReady: boolean = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  constructor(config: DiscordConfig) {
    this.config = config;
    const intents = config.intents || [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ];
    this.client = new Client({ intents });
    this.setupEventHandlers();
  }
  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      console.log(`[discord]: Bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });
    this.client.on('error', (error) => {
      console.error('[discord]: Client error:', error);
    });
  }
  async login(): Promise<boolean> {
    try {
      await this.client.login(this.config.token);
      return true;
    } catch (error) {
      console.error('[discord]: Failed to login client:', error);
      return false;
    }
  }
  getClient(): Client {
    return this.client;
  }
  isClientReady(): boolean {
    return this.isReady;
  }
  getTextChannel(channelId?: string): TextChannel | null {
    const id = channelId || this.config.channelId;
    const channel = this.client.channels.cache.get(id);
    return DiscordUtils.isTextChannel(channel) ? channel : null;
  }
  getGuild(guildId?: string): Guild | null {
    const id = guildId || this.config.guildId;
    return this.client.guilds.cache.get(id) || null;
  }
  async sendMessage(
    options: MessageOptions,
    channelId?: string,
  ): Promise<boolean> {
    try {
      const channel = this.getTextChannel(channelId);
      if (!channel) {
        console.error(
          `[discord]: Channel not found: ${channelId || this.config.channelId}`,
        );
        return false;
      }
      await channel.send(options);
      return true;
    } catch (error) {
      console.error(
        '[discord]: Error sending message:',
        DiscordUtils.formatError(error),
      );
      return false;
    }
  }
  async registerCommands(
    commands: RESTPostAPIApplicationCommandsJSONBody[],
    guildId?: string,
  ): Promise<boolean> {
    try {
      const guild = this.getGuild(guildId);
      if (!guild) {
        console.error(
          `[discord]: Guild not found: ${guildId || this.config.guildId}`,
        );
        return false;
      }
      await guild.commands.set(commands);
      return true;
    } catch (error) {
      console.error('[discord]: Error registering commands:', error);
      return false;
    }
  }
  async replyToInteraction(
    interaction: ChatInputCommandInteraction,
    options: InteractionReplyOptions,
  ): Promise<boolean> {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(options);
      } else {
        await interaction.reply({
          ...options,
          ephemeral: options.ephemeral ?? false,
        });
      }
      return true;
    } catch (error) {
      console.error('[discord]: Error handling interaction reply:', error);
      return false;
    }
  }
  setInterval(name: string, callback: () => void, interval: number): void {
    this.clearInterval(name);
    const intervalId = setInterval(callback, interval);
    this.intervals.set(name, intervalId);
  }
  clearInterval(name: string): void {
    const intervalId = this.intervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(name);
    }
  }
  onInteraction(
    handler: (interaction: ChatInputCommandInteraction) => Promise<void>,
  ): void {
    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await handler(interaction);
      }
    });
  }
  onReady(handler: () => Promise<void>): void {
    this.client.once('ready', handler);
  }
  cleanup(): void {
    for (const [name] of this.intervals) {
      this.clearInterval(name);
    }
    console.log('[discord]: Client cleaned up');
  }
  async destroy(): Promise<void> {
    this.cleanup();
    await this.client.destroy();
  }
}
