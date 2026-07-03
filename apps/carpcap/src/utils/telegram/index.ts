import { TelegramNewsService } from '../../services/news/bot';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_USE_BOT_CHAT } from '../../env';
import fetch from 'node-fetch';

export interface TelegramConfig {botToken: string; channelId?: string; useBotChat?: boolean;}
export interface TelegramMessage {text: string; parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'; disable_web_page_preview?: boolean; disable_notification?: boolean;}
// export const baseUrl = `https://api.telegram.org/bot${token}`;

export class TelegramBot {
  private botToken: string;
  private channelId?: string;
  private baseUrl: string;
  private useBotChat: boolean = false;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.channelId = config.channelId;
    this.useBotChat = !!config.useBotChat;
    if (this.useBotChat && !this.channelId) { 
      this.channelId = process.env.TELEGRAM_CHAT_ID || undefined;
      if (this.channelId) {console.log(`Using persisted chat_id from environment: ${this.channelId}`);}
    }
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(message: TelegramMessage): Promise<boolean> {
    try {
      if (!this.channelId) {
        const resolved = await this.resolveDefaultChatId();
        if (!resolved) {console.error('No chat_id available to send message'); return false;}
      }
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          chat_id: this.channelId,
          text: message.text,
          parse_mode: message.parse_mode || 'HTML',
          disable_web_page_preview: message.disable_web_page_preview || false,
          disable_notification: message.disable_notification || false
        })
      });
      const result = await response.json();
      if (!response.ok) {console.error('Telegram API error:', result); return false;}
      return true;
    } 
    catch (error) {console.error('Error sending Telegram message:', error); return false;}
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      const result = await response.json();
      if (response.ok && result.ok) {console.log(`Telegram bot connected: @${result.result.username}`);return true;} 
      else {console.error('Telegram bot connection failed:', result); return false;}
    } 
    catch (error) {console.error('Error testing Telegram connection:', error); return false;}
  }

  async getChannelInfo(): Promise<any> {
    try {
      if (!this.channelId) {await this.resolveDefaultChatId();}
      if (!this.channelId) {console.error('No chat_id available to get channel info'); return null;}
      const response = await fetch(`${this.baseUrl}/getChat`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: this.channelId})});
      const result = await response.json();
      if (response.ok && result.ok) {return result.result;} 
      else {console.error('Error getting channel info:', result); return null;}
    } 
    catch (error) {console.error('Error fetching channel info:', error); return null;}
  }

  private async resolveDefaultChatId(): Promise<string | undefined> {
    if (!this.useBotChat) {return undefined;}
    if (this.channelId) {return this.channelId;}
    try {
      const response = await fetch(`${this.baseUrl}/getUpdates`);
      const result = await response.json();
      if (!response.ok || !result.ok) {console.error('Error fetching updates to resolve chat id:', result); return undefined;}
      const updates = Array.isArray(result.result) ? result.result : [];
      const extractChat = (u: any) => u?.message?.chat || u?.edited_message?.chat || u?.channel_post?.chat || u?.edited_channel_post?.chat;
      for (let i = updates.length - 1; i >= 0; i--) {
        const chat = extractChat(updates[i]);
        if (chat && chat.type === 'private' && chat.id) {
          this.channelId = chat.id.toString();
          console.log(`Resolved private bot chat id: ${this.channelId}`);
          console.log(`💡 To persist across restarts, add to .env: TELEGRAM_USE_BOT_CHAT=${this.channelId}`);
          return this.channelId;
        }
      }
      console.warn('No private chat found in recent updates. DM the bot once, then re-run.');
      return undefined;
    } 
    catch (error) {console.error('Failed to resolve bot chat id:', error); return undefined;}
  }
}

export const telegramService = new TelegramNewsService({botToken: TELEGRAM_BOT_TOKEN || '',  channelId: TELEGRAM_USE_BOT_CHAT, useBotChat: true});
export const telegramBot = new TelegramBot({botToken: TELEGRAM_BOT_TOKEN || '', channelId: TELEGRAM_USE_BOT_CHAT, useBotChat: true});
let telegramInitialized = false;

export async function initTelegram() {
  if (!telegramInitialized && telegramService.isReady()) {
    telegramInitialized = await telegramService.initialize();
    if (!telegramInitialized) {console.warn('Telegram service failed to initialize');} 
  } 
  else if (!telegramService.isReady()) {console.log('Telegram service not configured - news will not be posted');}
}

export function normalizeChatInput(chat: string): string {
  if (/^-?\d+$/.test(chat)) return chat;
  if (!chat.startsWith('@')) return `@${chat}`;
  return chat;
}

export async function getChatByUsername(baseUrl: string, chat: string) {
  const chatId = normalizeChatInput(chat);
  const response = await fetch(`${baseUrl}/getChat`, {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId })});
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const hint = 'Hint: For DMs (users), you cannot use @username. DM the bot once, then run without --username to list chats.';
    throw new Error(`getChat failed: ${JSON.stringify(result)}\n${hint}`);
  }
  return result.result;
}

export async function listChatsFromUpdates(baseUrl: string) {
  const response = await fetch(`${baseUrl}/getUpdates`);
  const result = await response.json();
  if (!response.ok || !result.ok) {throw new Error(`getUpdates failed: ${JSON.stringify(result)}`);}
  const updates: any[] = Array.isArray(result.result) ? result.result : [];
  const extractChat = (u: any) => u?.message?.chat || u?.edited_message?.chat || u?.channel_post?.chat || u?.edited_channel_post?.chat;
  const seen = new Map<string, any>();
  for (const u of updates) {
    const chat = extractChat(u);
    if (chat && chat.id != null) {const id = String(chat.id); if (!seen.has(id)) { seen.set(id, chat); }}
  }
  return Array.from(seen.values());
}

export async function fetchTelegramChannelPaginated(channelUsername: string, maxPages: number = 20, opts?: { checkHasExisting?: (links: string[]) => Promise<boolean> }): Promise<any[]> {
    const allMessages: any[] = [];
    let url: string | null = `https://t.me/s/${channelUsername}`;
    let pages = 0;
    const seenIds = new Set<string>();
    try {
        while (url && pages < maxPages) {
            pages++;
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fundraise Scraper/1.0)' } });
            if (!response.ok) {console.error(`    Failed to fetch: ${response.status}`); break;}
            const html = await response.text();
            const { messages, nextUrl } = parseTelegramHTMLWithMore(html, channelUsername);
            let added = 0;
            for (const m of messages) {
                const id = m.link;
                if (!seenIds.has(id)) {seenIds.add(id); allMessages.push(m); added++;}
            }
            if (!nextUrl || added === 0) break;
            const links = messages.map((m) => m.link).filter(Boolean);
            if (opts?.checkHasExisting && links.length > 0 && (await opts.checkHasExisting(links))) break;
            url = nextUrl.startsWith('http') ? nextUrl : `https://t.me${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
            await new Promise(r => setTimeout(r, 1500));
        }
        return allMessages;
    } 
    catch (error) {console.error(`Error fetching Telegram @${channelUsername}:`, error); return allMessages;}
}

function parseTelegramHTMLWithMore(html: string, channelUsername: string): { messages: any[]; nextUrl: string | null } {
  const articles: any[] = [];
  let nextUrl: string | null = null;
  try {
    const messageRegex = /<div class="tgme_widget_message_wrap[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const matches = html.matchAll(messageRegex);
    for (const match of matches) {
      const messageHtml = match[0];
      const idMatch = messageHtml.match(/data-post="[^"]*\/(\d+)"/);
      const messageId = idMatch?.[1];
      const textMatch = messageHtml.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
      let text = textMatch?.[1] || '';
      text = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
      const dateMatch = messageHtml.match(/<time[^>]*datetime="([^"]+)"/);
      const dateStr = dateMatch?.[1];
      const linkMatch = messageHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="tgme_widget_message_link_preview"/);
      const extractedLink = linkMatch?.[1];
      if (text && messageId) {
        articles.push({
          title: text.substring(0, 100),
          link: extractedLink || `https://t.me/${channelUsername}/${messageId}`,
          pubDate: dateStr ? new Date(dateStr) : new Date(),
          description: text,
          content: text,
          feedName: `Telegram: @${channelUsername}`,
        });
      }
    }
    const moreWrap = html.match(/<div[^>]*class="[^"]*js-messages_more_wrap[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>/i);
    const moreHref = moreWrap?.[1];
    if (moreHref && (moreHref.startsWith('/') || moreHref.includes('t.me'))) {nextUrl = moreHref;}
  } 
  catch (error) {console.error('Error parsing Telegram HTML:', error);}
  return { messages: articles, nextUrl };
}

export async function fetchAllTelegramChannelsPaginated(channels: string[], maxPagesPerChannel: number = 20, opts?: { checkHasExisting?: (links: string[]) => Promise<boolean> }): Promise<any[]> {
  console.log(`\nFetching ${channels.length} Telegram channels (up to ${maxPagesPerChannel} pages each)...`);
  const allArticles: any[] = [];
  for (const channel of channels) {
    const articles = await fetchTelegramChannelPaginated(channel, maxPagesPerChannel, opts);
    allArticles.push(...articles);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return allArticles;
}