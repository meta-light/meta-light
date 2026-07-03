import mongoose from 'mongoose';

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
  votes?: {negative?: number; positive?: number; important?: number;};
  sourceType: 'velo' | 'treeofalpha' | 'newsapi' | 'cryptopanic' | 'fmp';
  scrapedAt: Date;
}

const newsItemSchema = new mongoose.Schema<NewsItem>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  source: { type: String, required: true },
  url: { type: String, required: false },
  publishedAt: { type: Date, required: true },
  description: { type: String },
  content: { type: String },
  type: { 
    type: String, 
    enum: ['news', 'social', 'analysis', 'blog'],
    default: 'news'
  },
  impact: { 
    type: String, 
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  coin: { type: String },
  priority: { type: String },
  kind: { type: String },
  votes: {
    negative: { type: Number },
    positive: { type: Number },
    important: { type: Number }
  },
  sourceType: { 
    type: String, 
    enum: ['velo', 'treeofalpha', 'newsapi', 'cryptopanic', 'fmp'],
    required: true
  },
  scrapedAt: { type: Date, default: Date.now }
}, {timestamps: true, collection: 'carp-news'});

newsItemSchema.index({ publishedAt: -1 });
newsItemSchema.index({ source: 1 });
newsItemSchema.index({ sourceType: 1 });
newsItemSchema.index({ impact: 1 });
newsItemSchema.index({ type: 1 });
newsItemSchema.index({ coin: 1 });

export const NewsModel = mongoose.model<NewsItem>('NewsItem', newsItemSchema);

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
      sourceType: 'velo'
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
      sourceType: 'treeofalpha'
    };
  }

  static fromNewsAPI(article: any, index: number): Partial<NewsItem> {
    return {
      id: `newsapi-${Date.now()}-${index}`,
      title: NewsTransformer.cleanHtmlEntities(article.title),
      description: NewsTransformer.cleanHtmlEntities(article.description),
      source: NewsTransformer.cleanHtmlEntities(article.source?.name || 'NewsAPI'),
      url: article.url,
      publishedAt: new Date(article.publishedAt),
      type: 'news',
      impact: NewsTransformer.getImpactFromTitle(article.title),
      sourceType: 'newsapi'
    };
  }

  static fromCryptoPanic(post: any, index: number): Partial<NewsItem> {
    return {
      id: `cryptopanic-${Date.now()}-${index}`,
      title: NewsTransformer.cleanHtmlEntities(post.title || 'Untitled'),
      source: NewsTransformer.cleanHtmlEntities(post.source?.title || 'CryptoPanic'),
      url: post.url || '#',
      publishedAt: post.published_at ? new Date(post.published_at) : new Date(),
      kind: post.kind,
      votes: {
        negative: post.votes?.negative || 0,
        positive: post.votes?.positive || 0,
        important: post.votes?.important || 0
      },
      type: post.kind === 'news' ? 'news' : 'analysis',
      impact: NewsTransformer.getCryptoPanicImpact(post.votes),
      sourceType: 'cryptopanic'
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
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
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
    const highImpactWords = ['crash', 'surge', 'bull', 'bear', 'regulation', 'ban', 'approved', 'etf'];
    const mediumImpactWords = ['price', 'market', 'trading', 'volume', 'analysis'];
    const lowerTitle = title.toLowerCase();
    if (highImpactWords.some(word => lowerTitle.includes(word))) {return 'high';} 
    else if (mediumImpactWords.some(word => lowerTitle.includes(word))) {return 'medium';}
    return 'low';
  }
  
  static getCryptoPanicImpact(votes?: any): 'high' | 'medium' | 'low' {
    if (!votes) return 'low';
    if (votes.important > 5) return 'high';
    if (votes.positive > votes.negative && votes.positive > 3) return 'medium';
    return 'low';
  }
}
