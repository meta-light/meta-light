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
    const response = await fetch(`/api/news/newsapi?q=bitcoin OR ethereum OR cryptocurrency&language=en&sortBy=publishedAt&pageSize=20`);
    if (!response.ok) {throw new Error('Failed to fetch from NewsAPI');}
    const data = await response.json();
    return data.articles.map((article: NewsAPIArticle, index: number) => ({
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
    const response = await fetch(`/api/cryptopanic/posts?currencies=BTC,ETH,SOL&filter=important&approved=true`);
    if (!response.ok) {throw new Error('Failed to fetch from CryptoPanic');}
    const data = await response.json();
    if (!Array.isArray(data?.results)) {return [];}
    return data.results
      .filter((post: CryptoPanicPost) => Boolean(post && (post.title || post.url)))
      .map((post: CryptoPanicPost, index: number) => {
        const safeVotes = {negative: post?.votes?.negative ?? 0, positive: post?.votes?.positive ?? 0, important: post?.votes?.important ?? 0,};
        const publishedAt = post?.published_at ? new Date(post.published_at) : new Date();
        return {
          id: `cryptopanic-${index}`,
          title: post?.title ?? 'Untitled',
          source: post?.source?.title ?? 'CryptoPanic',
          time: getTimeAgo(publishedAt),
          url: post?.url ?? '#',
          impact: getCryptoPanicImpact(safeVotes),
          type: post?.kind === 'news' ? 'news' : 'analysis' as const,
        };
      });
  } 
  catch (error) {console.error('CryptoPanic error:', error); return [];}
}

export async function fetchFinancialModelingPrep(): Promise<NewsItem[]> {
  // This is a placeholder since FMP doesn't have direct crypto news endpoint
  return [
    {
      id: 'fmp-1',
      title: 'Major Crypto Exchange Reports Q4 Earnings',
      source: 'Financial Modeling Prep',
      time: '1 hr ago',
      url: '#',
      impact: 'medium',
      type: 'analysis'
    }
  ];
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
  const [newsApiResults, cryptoPanicResults, fmpResults] = await Promise.allSettled([fetchNewsAPI(), fetchCryptoPanic(), fetchFinancialModelingPrep()]);
  const allNews: NewsItem[] = [];
  if (newsApiResults.status === 'fulfilled') {allNews.push(...newsApiResults.value);}
  if (cryptoPanicResults.status === 'fulfilled') {allNews.push(...cryptoPanicResults.value);}
  if (fmpResults.status === 'fulfilled') {allNews.push(...fmpResults.value);}
  return allNews.sort((a, b) => {return a.time.localeCompare(b.time);});
} 