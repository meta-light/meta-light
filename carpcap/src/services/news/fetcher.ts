import { NEWS_API_ORG_KEY, CRYPTO_PANIC_KEY } from '../../env';

export async function queryNewsAPI(query: string) {
  const baseUrl = 'https://newsapi.org/v2/everything';
  if (!NEWS_API_ORG_KEY) {throw new Error('NEWS_API_ORG_KEY is not set');}
  const response = await fetch(`${baseUrl}?apiKey=${NEWS_API_ORG_KEY}&q=${query}&language=en&sortBy=publishedAt&pageSize=20`);
  const data = await response.json();
  return data.articles;
}

export async function queryCryptoPanic(currencies?: string) {
  const baseUrl = 'https://cryptopanic.com/api/developer/v2/posts/';
  if (!CRYPTO_PANIC_KEY) {throw new Error('CRYPTO_PANIC_KEY is not set');}
  let url = `${baseUrl}?auth_token=${CRYPTO_PANIC_KEY}&filter=important&public=true`;
  if (currencies) {url += `&currencies=${currencies}`;}
  const response = await fetch(url);
  const data = await response.json();
  return data.results;
}

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: {name: string;};
}

interface CryptoPanicPost {
  title?: string;
  url?: string;
  published_at?: string;
  kind?: string;
  source?: {title?: string;} | null;
  votes?: {negative?: number; positive?: number; important?: number;} | null;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  url: string;
  impact: 'high' | 'medium' | 'low';
  type: 'news' | 'social' | 'analysis';
}
  
export async function fetchNewsAPI(): Promise<NewsItem[]> {
  try {
    const articles = await queryNewsAPI('bitcoin OR ethereum OR cryptocurrency');
    if (!Array.isArray(articles)) {return [];}
    return articles.map((article: NewsAPIArticle, index: number) => ({
      id: `newsapi-${index}`,
      title: article.title,
      source: article.source.name,
      time: getTimeAgo(new Date(article.publishedAt)),
      url: article.url,
      impact: getImpactLevel(article.title),
      type: 'news' as const
    }));
  } 
  catch (error) {console.error('NewsAPI error:', error); return [];}
}
  
export async function fetchCryptoPanic(): Promise<NewsItem[]> {
  try {
    const results = await queryCryptoPanic();
    if (!Array.isArray(results)) {return [];}
    return results.filter((post: CryptoPanicPost) => Boolean(post && (post.title || post.url))).map((post: CryptoPanicPost, index: number) => {
      const safeVotes = {negative: post?.votes?.negative ?? 0, positive: post?.votes?.positive ?? 0, important: post?.votes?.important ?? 0};
      const publishedAt = post?.published_at ? new Date(post.published_at) : new Date();
      return {
        id: `cryptopanic-${index}`,
        title: post?.title ?? 'Untitled',
        source: post?.source?.title ?? 'CryptoPanic',
        time: getTimeAgo(publishedAt),
        url: post?.url ?? '#',
        impact: getCryptoPanicImpact(safeVotes),
        type: post?.kind === 'news' ? 'news' : 'analysis' as const
      };
    });
  } 
  catch (error) {console.error('CryptoPanic error:', error); return [];}
}
  
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInMins < 60) {return `${diffInMins} min ago`;} 
  else if (diffInHours < 24) {return `${diffInHours} hr ago`;} 
  else {return `${diffInDays} day ago`;}
}
  
function getImpactLevel(title: string): 'high' | 'medium' | 'low' {
  const highImpactWords = ['crash', 'surge', 'bull', 'bear', 'regulation', 'ban', 'approved', 'etf'];
  const mediumImpactWords = ['price', 'market', 'trading', 'volume', 'analysis'];
  const lowerTitle = title.toLowerCase();
  if (highImpactWords.some(word => lowerTitle.includes(word))) {return 'high';} 
  else if (mediumImpactWords.some(word => lowerTitle.includes(word))) {return 'medium';}
  return 'low';
}

function getCryptoPanicImpact(votes: { negative: number; positive: number; important: number }): 'high' | 'medium' | 'low' {
  if (votes.important > 5) return 'high';
  if (votes.positive > votes.negative && votes.positive > 3) return 'medium';
  return 'low';
}

export async function fetchAllNews(): Promise<NewsItem[]> {
  const [newsApiResults, cryptoPanicResults] = await Promise.allSettled([fetchNewsAPI(), fetchCryptoPanic()]);
  const allNews: NewsItem[] = [];
  if (newsApiResults.status === 'fulfilled') {allNews.push(...newsApiResults.value);}
  if (cryptoPanicResults.status === 'fulfilled') {allNews.push(...cryptoPanicResults.value);}
  return allNews.sort((a, b) => a.time.localeCompare(b.time));
}