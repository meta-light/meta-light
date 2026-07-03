import { TelegramBot, TelegramConfig } from '../../utils/telegram';
import { NewsItem } from './model';

export class TelegramNewsService {
  private bot: TelegramBot;
  private isConfigured: boolean = false;
  constructor(config: TelegramConfig) {
    this.bot = new TelegramBot(config);
    this.isConfigured = !!config.botToken;
  }

  async initialize(): Promise<boolean> {
    if (!this.isConfigured) {console.warn('Telegram not configured - missing bot token'); return false;}
    const isConnected = await this.bot.testConnection();
    if (isConnected) {await this.bot.getChannelInfo(); return true;}
    return false;
  }

  async sendNewsItem(newsItem: NewsItem): Promise<boolean> {
    if (!this.isConfigured) {console.log('Telegram not configured - skipping news post'); return false;}
    const message = TelegramNewsFormatter.formatNewsItem(newsItem);
    return await this.bot.sendMessage({text: message, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: false});
  }

  async sendNewsBatch(newsItems: NewsItem[], title?: string): Promise<boolean> {
    if (!this.isConfigured) {console.log('Telegram not configured - skipping news batch'); return false;}
    if (newsItems.length === 0) {return true;}
    const message = TelegramNewsFormatter.formatNewsBatch(newsItems, title);
    return await this.bot.sendMessage({text: message, parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: false});
  }

  async sendHighImpactNews(newsItems: NewsItem[]): Promise<boolean> {
    const highImpactNews = newsItems.filter(item => item.impact === 'high');
    if (highImpactNews.length === 0) {return true;}
    return await this.sendNewsBatch(highImpactNews, '🚨 High Impact Crypto News Alert');
  }
  
  isReady(): boolean {return this.isConfigured;}
}

class TelegramNewsFormatter {
  static formatNewsItem(newsItem: NewsItem): string {
    const impactEmoji = this.getImpactEmoji(newsItem.impact);
    const sourceEmoji = this.getSourceEmoji(newsItem.sourceType);
    const typeEmoji = this.getTypeEmoji(newsItem.type);
    const title = this.escapeHtml(newsItem.title);
    const source = this.escapeHtml(newsItem.source);
    let message = `${impactEmoji} <b>${title}</b>\n\n`;
    if (newsItem.description) {const description = this.escapeHtml(newsItem.description); message += `${description}\n\n`;}
    message += `${sourceEmoji} <i>${source}</i> • ${typeEmoji} ${newsItem.type.toUpperCase()}`;
    if (newsItem.coin) {message += ` • 🪙 ${newsItem.coin}`;}
    if (newsItem.votes && (newsItem.votes.positive || newsItem.votes.important)) {
      message += '\n';
      if (newsItem.votes.important) {message += `🔥 ${newsItem.votes.important} important`;}
      if (newsItem.votes.positive) {message += ` • 👍 ${newsItem.votes.positive}`;}
      if (newsItem.votes.negative) {message += ` • 👎 ${newsItem.votes.negative}`;}
    }
    if (newsItem.url && newsItem.url !== '#') {message += `\n\n🔗 <a href="${newsItem.url}">Read More</a>`;}
    const timeAgo = this.getTimeAgo(newsItem.publishedAt);
    message += `\n\n⏰ ${timeAgo}`;
    return message;
  }

  static formatNewsBatch(newsItems: NewsItem[], title: string = '📰 Latest Crypto News'): string {
    let message = `<b>${title}</b>\n\n`;
    newsItems.slice(0, 5).forEach((item, index) => {
      const impactEmoji = this.getImpactEmoji(item.impact);
      const title = this.escapeHtml(item.title);
      const source = this.escapeHtml(item.source);
      message += `${index + 1}. ${impactEmoji} ${title}\n`;
      message += `   <i>${source}</i>`;
      if (item.url && item.url !== '#') {message += ` • <a href="${item.url}">Link</a>`;}
      message += '\n\n';
    });
    if (newsItems.length > 5) {message += `<i>... and ${newsItems.length - 5} more news items</i>`;}
    return message;
  }

  private static getImpactEmoji(impact: string): string {switch (impact) {case 'high': return '🔴'; case 'medium': return '🟡'; case 'low': return '🟢'; default: return '⚪';}}
  private static getSourceEmoji(sourceType: string): string {switch (sourceType) {case 'velo': return '🌊'; case 'treeofalpha': return '🌳'; case 'newsapi': return '📡'; case 'cryptopanic': return '💰'; case 'fmp': return '📊'; default: return '📰';}}
  private static getTypeEmoji(type: string): string {switch (type) {case 'news': return '📰'; case 'analysis': return '📊'; case 'social': return '💬'; case 'blog': return '📝'; default: return '📄';}}
  private static escapeHtml(text: string): string {if (!text) return ''; return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');}

  private static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInMins < 60) {return `${diffInMins}m ago`;} 
    else if (diffInHours < 24) {return `${diffInHours}h ago`;} 
    else {return `${diffInDays}d ago`;}
  }
}

export { TelegramBot, TelegramConfig, TelegramNewsFormatter };