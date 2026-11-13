import { TelegramBot, type TelegramConfig } from '../providers/telegram';

export async function fetchLatestNews(): Promise<Partial<NewsItem>[]> {
  const [scraped, newsApi] = await Promise.allSettled([
    scrapeLatestNews(),
    queryNewsAPI('bitcoin OR ethereum OR cryptocurrency'),
  ]);
  const items = scraped.status === 'fulfilled' ? scraped.value : [];
  const articles: any[] =
    newsApi.status === 'fulfilled' ? (newsApi.value ?? []) : [];
  const isVelo = (source?: string) =>
    !source || source.toLowerCase().includes('velo');
  return [
    ...items.filter((i) => isVelo(i.source)).map(NewsTransformer.fromVeloNews),
    ...items
      .filter((i) => !isVelo(i.source))
      .map(NewsTransformer.fromTreeOfAlpha),
    ...articles.map((a, i) => NewsTransformer.fromNewsAPI(a, i)),
  ];
}

const NEWS_API_ORG_KEY = process.env.NEWS_API_ORG_KEY;
const CRYPTO_PANIC_KEY = process.env.CRYPTO_PANIC_KEY;

export async function queryNewsAPI(query: string) {
  const baseUrl = 'https://newsapi.org/v2/everything';
  if (!NEWS_API_ORG_KEY) {
    throw new Error('NEWS_API_ORG_KEY is not set');
  }
  const response = await fetch(
    `${baseUrl}?apiKey=${NEWS_API_ORG_KEY}&q=${query}&language=en&sortBy=publishedAt&pageSize=20`,
  );
  const data = await response.json();
  return data.articles;
}

export async function queryCryptoPanic(currencies?: string) {
  const baseUrl = 'https://cryptopanic.com/api/developer/v2/posts/';
  if (!CRYPTO_PANIC_KEY) {
    throw new Error('CRYPTO_PANIC_KEY is not set');
  }
  let url = `${baseUrl}?auth_token=${CRYPTO_PANIC_KEY}&filter=important&public=true`;
  if (currencies) {
    url += `&currencies=${currencies}`;
  }
  const response = await fetch(url);
  const data = await response.json();
  return data.results;
}

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: { name: string };
}

interface CryptoPanicPost {
  title?: string;
  url?: string;
  published_at?: string;
  kind?: string;
  source?: { title?: string } | null;
  votes?: { negative?: number; positive?: number; important?: number } | null;
}

export interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  time: string;
  url: string;
  impact: 'high' | 'medium' | 'low';
  type: 'news' | 'social' | 'analysis';
}

export async function fetchNewsAPI(): Promise<NewsHeadline[]> {
  try {
    const articles = await queryNewsAPI(
      'bitcoin OR ethereum OR cryptocurrency',
    );
    if (!Array.isArray(articles)) {
      return [];
    }
    return articles.map((article: NewsAPIArticle, index: number) => ({
      id: `newsapi-${index}`,
      title: article.title,
      source: article.source.name,
      time: getTimeAgo(new Date(article.publishedAt)),
      url: article.url,
      impact: getImpactLevel(article.title),
      type: 'news' as const,
    }));
  } catch (error) {
    console.error('NewsAPI error:', error);
    return [];
  }
}

export async function fetchCryptoPanic(): Promise<NewsHeadline[]> {
  try {
    const results = await queryCryptoPanic();
    if (!Array.isArray(results)) {
      return [];
    }
    return results
      .filter((post: CryptoPanicPost) =>
        Boolean(post && (post.title || post.url)),
      )
      .map((post: CryptoPanicPost, index: number) => {
        const safeVotes = {
          negative: post?.votes?.negative ?? 0,
          positive: post?.votes?.positive ?? 0,
          important: post?.votes?.important ?? 0,
        };
        const publishedAt = post?.published_at
          ? new Date(post.published_at)
          : new Date();
        return {
          id: `cryptopanic-${index}`,
          title: post?.title ?? 'Untitled',
          source: post?.source?.title ?? 'CryptoPanic',
          time: getTimeAgo(publishedAt),
          url: post?.url ?? '#',
          impact: getCryptoPanicImpact(safeVotes),
          type: post?.kind === 'news' ? 'news' : ('analysis' as const),
        };
      });
  } catch (error) {
    console.error('CryptoPanic error:', error);
    return [];
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInMins < 60) {
    return `${diffInMins} min ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  } else {
    return `${diffInDays} day ago`;
  }
}

function getImpactLevel(title: string): 'high' | 'medium' | 'low' {
  const highImpactWords = [
    'crash',
    'surge',
    'bull',
    'bear',
    'regulation',
    'ban',
    'approved',
    'etf',
  ];
  const mediumImpactWords = [
    'price',
    'market',
    'trading',
    'volume',
    'analysis',
  ];
  const lowerTitle = title.toLowerCase();
  if (highImpactWords.some((word) => lowerTitle.includes(word))) {
    return 'high';
  } else if (mediumImpactWords.some((word) => lowerTitle.includes(word))) {
    return 'medium';
  }
  return 'low';
}

function getCryptoPanicImpact(votes: {
  negative: number;
  positive: number;
  important: number;
}): 'high' | 'medium' | 'low' {
  if (votes.important > 5) return 'high';
  if (votes.positive > votes.negative && votes.positive > 3) return 'medium';
  return 'low';
}

export async function fetchAllNews(): Promise<NewsHeadline[]> {
  const [newsApiResults, cryptoPanicResults] = await Promise.allSettled([
    fetchNewsAPI(),
    fetchCryptoPanic(),
  ]);
  const allNews: NewsHeadline[] = [];
  if (newsApiResults.status === 'fulfilled') {
    allNews.push(...newsApiResults.value);
  }
  if (cryptoPanicResults.status === 'fulfilled') {
    allNews.push(...cryptoPanicResults.value);
  }
  return allNews.sort((a, b) => a.time.localeCompare(b.time));
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  description?: string;
  content?: string;
  type: 'news' | 'social' | 'analysis' | 'blog';
  impact: 'high' | 'medium' | 'low';
  coin?: string;
  priority?: string;
  kind?: string;
  votes?: { negative?: number; positive?: number; important?: number };
  sourceType: 'velo' | 'treeofalpha' | 'newsapi' | 'cryptopanic' | 'fmp';
  scrapedAt: Date;
}

export class NewsTransformer {
  static fromVeloNews(item: any): Partial<NewsItem> {
    return {
      id: `velo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: NewsTransformer.cleanHtmlEntities(item.title),
      source: NewsTransformer.cleanHtmlEntities(item.source || 'Velo'),
      url: item.link || '#',
      publishedAt: NewsTransformer.parseDate(item.date),
      coin: item.coin,
      priority: item.priority,
      type: 'news',
      impact: NewsTransformer.getImpactFromPriority(item.priority),
      sourceType: 'velo',
    };
  }

  static fromTreeOfAlpha(item: any): Partial<NewsItem> {
    return {
      id: `toa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: NewsTransformer.cleanHtmlEntities(item.title),
      source: NewsTransformer.cleanHtmlEntities(item.source || 'Tree of Alpha'),
      url: item.link || '#',
      publishedAt: NewsTransformer.parseDate(item.date),
      type: 'analysis',
      impact: 'medium',
      sourceType: 'treeofalpha',
    };
  }

  static fromNewsAPI(article: any, index: number): Partial<NewsItem> {
    return {
      id: `newsapi-${Date.now()}-${index}`,
      title: NewsTransformer.cleanHtmlEntities(article.title),
      description: NewsTransformer.cleanHtmlEntities(article.description),
      source: NewsTransformer.cleanHtmlEntities(
        article.source?.name || 'NewsAPI',
      ),
      url: article.url,
      publishedAt: new Date(article.publishedAt),
      type: 'news',
      impact: NewsTransformer.getImpactFromTitle(article.title),
      sourceType: 'newsapi',
    };
  }

  static fromCryptoPanic(post: any, index: number): Partial<NewsItem> {
    return {
      id: `cryptopanic-${Date.now()}-${index}`,
      title: NewsTransformer.cleanHtmlEntities(post.title || 'Untitled'),
      source: NewsTransformer.cleanHtmlEntities(
        post.source?.title || 'CryptoPanic',
      ),
      url: post.url || '#',
      publishedAt: post.published_at ? new Date(post.published_at) : new Date(),
      kind: post.kind,
      votes: {
        negative: post.votes?.negative || 0,
        positive: post.votes?.positive || 0,
        important: post.votes?.important || 0,
      },
      type: post.kind === 'news' ? 'news' : 'analysis',
      impact: NewsTransformer.getCryptoPanicImpact(post.votes),
      sourceType: 'cryptopanic',
    };
  }

  static cleanHtmlEntities(text: string): string {
    if (!text) return text;
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&hellip;/g, '…')
      .replace(/&lsquo;/g, '\u2018')
      .replace(/&rsquo;/g, '\u2019')
      .replace(/&ldquo;/g, '\u201C')
      .replace(/&rdquo;/g, '\u201D')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
  }

  static parseDate(dateString: string): Date {
    if (!dateString) return new Date();
    const direct = new Date(dateString);
    if (!isNaN(direct.getTime())) return direct;
    const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const rest = match[4] || '';
      const swapped = new Date(`${month}/${day}/${year}${rest}`);
      if (!isNaN(swapped.getTime())) return swapped;
    }
    return new Date();
  }

  static getImpactFromPriority(priority?: string): 'high' | 'medium' | 'low' {
    if (!priority) return 'medium';
    const p = priority.toLowerCase();
    if (p.includes('high') || p.includes('urgent')) return 'high';
    if (p.includes('low')) return 'low';
    return 'medium';
  }

  static getImpactFromTitle(title: string): 'high' | 'medium' | 'low' {
    const highImpactWords = [
      'crash',
      'surge',
      'bull',
      'bear',
      'regulation',
      'ban',
      'approved',
      'etf',
    ];
    const mediumImpactWords = [
      'price',
      'market',
      'trading',
      'volume',
      'analysis',
    ];
    const lowerTitle = title.toLowerCase();
    if (highImpactWords.some((word) => lowerTitle.includes(word))) {
      return 'high';
    } else if (mediumImpactWords.some((word) => lowerTitle.includes(word))) {
      return 'medium';
    }
    return 'low';
  }

  static getCryptoPanicImpact(votes?: any): 'high' | 'medium' | 'low' {
    if (!votes) return 'low';
    if (votes.important > 5) return 'high';
    if (votes.positive > votes.negative && votes.positive > 3) return 'medium';
    return 'low';
  }
}

import puppeteer from 'puppeteer';

interface VeloNewsItem {
  title: string;
  date: string;
  source?: string;
  coin?: string;
  priority?: string;
  link?: string;
}
interface ScrapingResult {
  success: boolean;
  data: VeloNewsItem[];
  totalItems: number;
  timestamp: string;
  error?: string;
}

async function scrapeVeloNews(): Promise<ScrapingResult> {
  const result: ScrapingResult = {
    success: false,
    data: [],
    totalItems: 0,
    timestamp: new Date().toISOString(),
  };
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.goto('https://velo.xyz/news', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('.news-item', { timeout: 15000 });
    const newsItems = await page.evaluate(() => {
      const items: any[] = [];
      const newsElements = document.querySelectorAll('.news-item');
      newsElements.forEach((element: any) => {
        const titleEl = element.querySelector('h3');
        const title = titleEl ? titleEl.textContent?.trim() || '' : '';
        const dateEl = element.querySelector('.time-posted');
        const date = dateEl ? dateEl.textContent?.trim() || '' : '';
        const sourceEl = element.querySelector('.source');
        const source = sourceEl ? sourceEl.textContent?.trim() || '' : '';
        const coin = element.getAttribute('data-coin') || '';
        const priority = element.getAttribute('data-priority') || '';
        const linkEl = element.querySelector('a');
        const link = linkEl ? linkEl.href : '';
        if (title) {
          items.push({
            title,
            date,
            source: source || undefined,
            coin: coin || undefined,
            priority: priority || undefined,
            link: link || undefined,
          });
        }
      });
      return items;
    });
    result.data = newsItems;
    result.totalItems = newsItems.length;
    result.success = true;
    console.log(`Successfully scraped ${result.totalItems} news items`);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('Scraping failed:', result.error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return result;
}

async function scrapeTreeOfAlphaNews(): Promise<ScrapingResult> {
  const result: ScrapingResult = {
    success: false,
    data: [],
    totalItems: 0,
    timestamp: new Date().toISOString(),
  };
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.goto('https://news.treeofalpha.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForSelector('.contentTitle a', { timeout: 20000 });
    const scrollContainerSelector = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('div,main,section'),
      ) as HTMLElement[];
      let best: HTMLElement | null = null;
      let bestScore = 0;
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const sh = el.scrollHeight;
        const ch = el.clientHeight;
        if ((overflowY === 'auto' || overflowY === 'scroll') && sh > ch + 50) {
          const containsItems =
            el.querySelector('[data-item-index]') ||
            el.querySelector('.contentTitle a');
          if (containsItems) {
            const score = sh - ch;
            if (score > bestScore) {
              best = el;
              bestScore = score;
            }
          }
        }
      }
      if (best) {
        best.setAttribute('data-scroll-target', 'toa-news');
        return '[data-scroll-target="toa-news"]';
      }
      document.body.setAttribute('data-scroll-target', 'toa-body');
      return 'body';
    });
    const collected = new Map<string, any>();
    let stableRounds = 0;
    let lastCount = 0;
    for (let i = 0; i < 80 && stableRounds < 8; i++) {
      const batch = await page.evaluate(() => {
        const out: {
          title: string;
          date: string;
          source?: string;
          link?: string;
        }[] = [];
        const anchors = Array.from(
          document.querySelectorAll('.contentTitle a'),
        ) as HTMLAnchorElement[];
        for (const linkEl of anchors) {
          const href = linkEl.href || '';
          let host = '';
          try {
            host = new URL(href, location.href).hostname.toLowerCase();
          } catch {}
          if (!href || host.endsWith('x.com') || host.endsWith('twitter.com'))
            continue;
          const card = linkEl.closest(
            '.box.padding-smallest.rowToColumn',
          ) as HTMLElement | null;
          if (!card) continue;
          const title = (linkEl.textContent || '').trim();
          const timeWrapper = card.querySelector(
            '.originTime',
          ) as HTMLElement | null;
          const date = (timeWrapper?.textContent || '').trim();
          let source = '';
          const colonIndex = title.indexOf(':');
          if (colonIndex > 0) source = title.slice(0, colonIndex).trim();
          else source = host.replace(/^www\./, '');
          if (title)
            out.push({ title, date, source: source || undefined, link: href });
        }
        return out;
      });
      for (const item of batch) {
        if (!item.link) continue;
        collected.set(item.link, item);
      }
      if (collected.size > lastCount) {
        lastCount = collected.size;
        stableRounds = 0;
      } else {
        stableRounds += 1;
      }
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          el.scrollTop = el.scrollTop + Math.floor(el.clientHeight * 0.9);
        } else {
          window.scrollBy(0, Math.floor(window.innerHeight * 0.9));
        }
      }, scrollContainerSelector);
      await new Promise((r) => setTimeout(r, 500));
    }
    const newsItems = Array.from(collected.values());
    result.data = newsItems;
    result.totalItems = newsItems.length;
    result.success = true;
    console.log(
      `Successfully scraped ${result.totalItems} Tree of Alpha news items`,
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('Tree of Alpha scraping failed:', result.error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return result;
}

function parseDateString(dateString: string): number {
  if (!dateString) return 0;
  const cleaned = dateString.replace(/\s+/g, ' ').trim();
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const rest = match[4] || '';
    const swapped = new Date(`${month}/${day}/${year}${rest}`);
    if (!Number.isNaN(swapped.getTime())) return swapped.getTime();
  }
  return 0;
}

export async function scrapeLatestNews(): Promise<VeloNewsItem[]> {
  const velo = await scrapeVeloNews();
  const toa = await scrapeTreeOfAlphaNews();
  const merged = [...(velo.data || []), ...(toa.data || [])];
  return merged.sort(
    (a, b) => parseDateString(b.date) - parseDateString(a.date),
  );
}

if (require.main === module) {
  scrapeLatestNews()
    .then((items) => {
      console.log(`Scraped ${items.length} items`);
    })
    .catch(console.error);
}

export type { VeloNewsItem, ScrapingResult };

export class TelegramNewsService {
  private bot: TelegramBot;
  private isConfigured: boolean = false;
  constructor(config: TelegramConfig) {
    this.bot = new TelegramBot(config);
    this.isConfigured = !!config.botToken;
  }

  async initialize(): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Telegram not configured - missing bot token');
      return false;
    }
    const isConnected = await this.bot.testConnection();
    if (isConnected) {
      await this.bot.getChannelInfo();
      return true;
    }
    return false;
  }

  async sendNewsItem(newsItem: NewsItem): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('Telegram not configured - skipping news post');
      return false;
    }
    const message = TelegramNewsFormatter.formatNewsItem(newsItem);
    return await this.bot.sendMessage({
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: false,
    });
  }

  async sendNewsBatch(newsItems: NewsItem[], title?: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('Telegram not configured - skipping news batch');
      return false;
    }
    if (newsItems.length === 0) {
      return true;
    }
    const message = TelegramNewsFormatter.formatNewsBatch(newsItems, title);
    return await this.bot.sendMessage({
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: false,
    });
  }

  async sendHighImpactNews(newsItems: NewsItem[]): Promise<boolean> {
    const highImpactNews = newsItems.filter((item) => item.impact === 'high');
    if (highImpactNews.length === 0) {
      return true;
    }
    return await this.sendNewsBatch(
      highImpactNews,
      '🚨 High Impact Crypto News Alert',
    );
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

class TelegramNewsFormatter {
  static formatNewsItem(newsItem: NewsItem): string {
    const impactEmoji = this.getImpactEmoji(newsItem.impact);
    const sourceEmoji = this.getSourceEmoji(newsItem.sourceType);
    const typeEmoji = this.getTypeEmoji(newsItem.type);
    const title = this.escapeHtml(newsItem.title);
    const source = this.escapeHtml(newsItem.source);
    let message = `${impactEmoji} <b>${title}</b>\n\n`;
    if (newsItem.description) {
      const description = this.escapeHtml(newsItem.description);
      message += `${description}\n\n`;
    }
    message += `${sourceEmoji} <i>${source}</i> • ${typeEmoji} ${newsItem.type.toUpperCase()}`;
    if (newsItem.coin) {
      message += ` • 🪙 ${newsItem.coin}`;
    }
    if (
      newsItem.votes &&
      (newsItem.votes.positive || newsItem.votes.important)
    ) {
      message += '\n';
      if (newsItem.votes.important) {
        message += `🔥 ${newsItem.votes.important} important`;
      }
      if (newsItem.votes.positive) {
        message += ` • 👍 ${newsItem.votes.positive}`;
      }
      if (newsItem.votes.negative) {
        message += ` • 👎 ${newsItem.votes.negative}`;
      }
    }
    if (newsItem.url && newsItem.url !== '#') {
      message += `\n\n🔗 <a href="${newsItem.url}">Read More</a>`;
    }
    const timeAgo = this.getTimeAgo(newsItem.publishedAt);
    message += `\n\n⏰ ${timeAgo}`;
    return message;
  }

  static formatNewsBatch(
    newsItems: NewsItem[],
    title: string = '📰 Latest Crypto News',
  ): string {
    let message = `<b>${title}</b>\n\n`;
    newsItems.slice(0, 5).forEach((item, index) => {
      const impactEmoji = this.getImpactEmoji(item.impact);
      const title = this.escapeHtml(item.title);
      const source = this.escapeHtml(item.source);
      message += `${index + 1}. ${impactEmoji} ${title}\n`;
      message += `   <i>${source}</i>`;
      if (item.url && item.url !== '#') {
        message += ` • <a href="${item.url}">Link</a>`;
      }
      message += '\n\n';
    });
    if (newsItems.length > 5) {
      message += `<i>... and ${newsItems.length - 5} more news items</i>`;
    }
    return message;
  }

  private static getImpactEmoji(impact: string): string {
    switch (impact) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }
  private static getSourceEmoji(sourceType: string): string {
    switch (sourceType) {
      case 'velo':
        return '🌊';
      case 'treeofalpha':
        return '🌳';
      case 'newsapi':
        return '📡';
      case 'cryptopanic':
        return '💰';
      case 'fmp':
        return '📊';
      default:
        return '📰';
    }
  }
  private static getTypeEmoji(type: string): string {
    switch (type) {
      case 'news':
        return '📰';
      case 'analysis':
        return '📊';
      case 'social':
        return '💬';
      case 'blog':
        return '📝';
      default:
        return '📄';
    }
  }
  private static escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInMins < 60) {
      return `${diffInMins}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${diffInDays}d ago`;
    }
  }
}

export { TelegramNewsFormatter };
