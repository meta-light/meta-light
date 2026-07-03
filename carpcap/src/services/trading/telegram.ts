import { TelegramBot, TelegramConfig } from '../../utils/telegram';
import { CombinedPerformanceData } from './models/interfaces';
import { TradingConfig } from './config';

export class TelegramTradingService {
  private bot: TelegramBot;
  private isConfigured: boolean = false;
  private reportInterval: NodeJS.Timeout | null = null;
  constructor(config: TelegramConfig) {this.bot = new TelegramBot({ ...config, useBotChat: true, channelId: undefined }); this.isConfigured = !!config.botToken;}

  async initialize(): Promise<boolean> {
    if (!this.isConfigured) {console.warn('Telegram not configured - missing bot token'); return false;}
    const isConnected = await this.bot.testConnection();
    if (isConnected) {await this.bot.getChannelInfo(); return true;}
    return false;
  }

  async sendPerformanceReport(combinedData: CombinedPerformanceData): Promise<boolean> {
    if (!this.isConfigured) {console.log('Telegram not configured - skipping performance report'); return false;}
    const message = TelegramTradingFormatter.formatPerformanceReport(combinedData);
    return await this.bot.sendMessage({text: message, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: false});
  }

  async sendTradingStatus(combinedData: CombinedPerformanceData): Promise<boolean> {
    if (!this.isConfigured) {console.log('Telegram not configured - skipping trading status'); return false;}
    const message = TelegramTradingFormatter.formatTradingStatus(combinedData);
    return await this.bot.sendMessage({text: message, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: false});
  }

  async sendStartupMessage(): Promise<boolean> {
    if (!this.isConfigured) {console.log('Telegram not configured - skipping startup message'); return false;}
    const message = TelegramTradingFormatter.formatStartupMessage();
    return await this.bot.sendMessage({text: message, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: false});
  }

  setPerformanceReportInterval(getPerformanceData: () => CombinedPerformanceData, intervalMs: number = 8 * 60 * 60 * 1000): void {
    if (this.reportInterval) {clearInterval(this.reportInterval);}
    const sendReport = async () => {
      try {
        const performanceData = getPerformanceData();
        const success = await this.sendPerformanceReport(performanceData);
        if (success) {console.log('[TradingBot] Performance report sent via Telegram');} 
        else {console.error('[TradingBot] Failed to send performance report via Telegram');}
      } 
      catch (error) {console.error('[TradingBot] Error sending performance report:', error);}
    };
    this.reportInterval = setInterval(sendReport, intervalMs);
    console.log(`[TradingBot] Performance report interval set to ${intervalMs / 1000 / 60} minutes`);
  }

  cleanup(): void {if (this.reportInterval) {clearInterval(this.reportInterval); this.reportInterval = null;}}
  isReady(): boolean {return this.isConfigured;}
}

export class TelegramTradingFormatter {
  static formatPerformanceReport(combinedData: CombinedPerformanceData): string {
    const { chains, totalCombinedValue, totalCombinedTrades, isAnyActive } = combinedData;
    if (!isAnyActive) {return '⚫ <b>Trading Status</b>\n\nNo trading chains are currently active or have data.';}
    let message = '<b>Complete Trading Performance Report</b>\n\n';
    message += '💰 <b>Portfolio Overview</b>\n';
    message += `💵 <b>Combined Portfolio Value:</b> $${totalCombinedValue.toFixed(2)}\n`;
    message += `📈 <b>Total Combined Trades:</b> ${totalCombinedTrades}\n`;
    message += `⚡ <b>Active Chains:</b> ${chains.filter(c => c.isRunning).length}/${chains.length}\n\n`;
    chains.forEach(chain => {
      const { name, mode, performance, isRunning } = chain;
      const chainEmoji = this.getChainEmoji(name);
      if (!isRunning || !performance) {message += `${chainEmoji} <b>${name} (${mode})</b>\n`; message += '⚫ Inactive - Not running or no data\n\n'; return;}
      const totalPortfolioValue = (performance as any).totalPortfolioValue || (performance as any).portfolioValue || 0;
      const totalReturn = (performance as any).totalReturn || 0;
      const strategies = (performance as any).strategies || [];
      const totalTrades = strategies?.reduce((sum: number, s: any) => sum + Math.max(0, s.totalTrades || 0), 0) || Math.max(0, (performance as any).totalTrades || 0);
      const profitableTrades = strategies?.reduce((sum: number, s: any) => sum + Math.max(0, s.successfulTrades || 0), 0) || 0;
      const winRate = totalTrades > 0 ? Math.min(100, Math.max(0, (profitableTrades / totalTrades) * 100)) : 0;
      const config = this.getChainConfig(name);
      const initialBalance = config.INITIAL_BALANCE;
      const profitLoss = totalPortfolioValue - initialBalance;
      const totalRealizedPnL = strategies?.reduce((sum: number, s: any) => sum + (s.realizedPnL || 0), 0) || 0;
      const positions = (performance as any).positions || [];
      const unrealizedFallback = Array.isArray(positions) ? positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnL || 0), 0) : 0;
      const totalUnrealizedPnL = strategies?.reduce((sum: number, s: any) => sum + (s.unrealizedPnL || 0), 0) || unrealizedFallback;
      const perfFees = (performance as any).totalFeesPaid || 0;
      const totalFeesPaid = strategies?.reduce((sum: number, s: any) => sum + (s.totalFeesPaid || 0), 0) || perfFees || 0;
      message += `${chainEmoji} <b>${name} (${mode})</b>\n`;
      message += `💵 <b>Value:</b> $${totalPortfolioValue.toFixed(2)}\n`;
      message += `<b>Return:</b> ${(totalReturn * 100).toFixed(2)}%\n`;
      message += `💰 <b>P&L:</b> ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}\n`;
      message += `🔄 <b>Trades:</b> ${totalTrades} (${winRate.toFixed(1)}% win)\n`;
      message += `<b>Realized:</b> ${totalRealizedPnL >= 0 ? '+' : ''}$${totalRealizedPnL.toFixed(2)}\n`;
      message += `⏳ <b>Unrealized:</b> ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)}\n`;
      message += `💸 <b>Fees Paid:</b> $${totalFeesPaid.toFixed(2)}\n\n`;
    });
    return message.trim();
  }

  static formatTradingStatus(combinedData: CombinedPerformanceData): string {
    const { chains, isAnyActive } = combinedData;
    let message = '🤖 <b>Trading Bot Status</b>\n\n';
    if (!isAnyActive) {message += '⚫ No trading chains are currently active\n'; return message;}
    const activeChains = chains.filter(c => c.isRunning);
    const inactiveChains = chains.filter(c => !c.isRunning);
    message += `<b>Active Chains:</b> ${activeChains.length}\n`;
    message += `⚫ <b>Inactive Chains:</b> ${inactiveChains.length}\n\n`;
    if (activeChains.length > 0) {message += '🟢 <b>Running:</b>\n'; activeChains.forEach(chain => {const chainEmoji = this.getChainEmoji(chain.name); message += `${chainEmoji} ${chain.name} (${chain.mode})\n`;});}
    if (inactiveChains.length > 0) {message += '\n🔴 <b>Stopped:</b>\n'; inactiveChains.forEach(chain => {const chainEmoji = this.getChainEmoji(chain.name); message += `${chainEmoji} ${chain.name} (${chain.mode})\n`;});}
    return message;
  }

  static formatStartupMessage(): string {return '🤖 <b>CarpCap Trading Bot Started</b>\n\nTelegram integration is now active!';}
  private static getChainEmoji(chainName: string): string {switch (chainName) {case 'SOLANA': return '🌞'; case 'ECLIPSE': return '🌒'; default: return '🤖';}}

  private static getChainConfig(chainName: string) {
    switch (chainName) {
      case 'SOLANA': return { ...TradingConfig, ...TradingConfig.SOLANA, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE };
      case 'ECLIPSE': return { ...TradingConfig, ...TradingConfig.ECLIPSE, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE };
      default: return { ...TradingConfig, ...TradingConfig.SOLANA, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE };
    }
  }
}