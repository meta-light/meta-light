import { fetchLatestTweets } from '../../utils/twitter';
import { X_TRACKING, HOURS_TO_ANALYZE, USER_PROFILE } from './config';
import { TrackedProfileTweet} from './interface';
import { Tweets, ITweet } from '../../utils/twitter/schema';

export function escapeMarkdown(text: string): string {return text.replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, '\\`').replace(/\[/g, '\\[');}
export function truncateText(text: string, maxLength: number): string {if (text.length <= maxLength) return text; return text.substring(0, maxLength) + '...';}
export function delay(ms: number): Promise<void> {return new Promise(resolve => setTimeout(resolve, ms));}
export function extractTweetId(input: string): string | null {if (/^\d+$/.test(input)) { return input; } try {const parsedUrl = new URL(input); const match = parsedUrl.pathname.match(/status\/(\d+)/); return match ? match[1] : null;}  catch {return null;}}
export function getAccountFromTweetURL(url: string): string | null {try {const parsed = new URL(url); const parts = parsed.pathname.split('/').filter(Boolean); if (parts.length >= 3 && parts[1] === 'status') {return parts[0];} return null;} catch {return null;}}
export function isWithinHours(isoDate: string, hours: number, now = new Date()): boolean {const t = Date.parse(isoDate); if (Number.isNaN(t)) return false; return (now.getTime() - t) <= hours * 60 * 60 * 1000;}

export async function fetchTweetsForAnalysis(): Promise<ITweet[]> {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - HOURS_TO_ANALYZE * 60 * 60 * 1000);
    const tweets = await Tweets.find({createdAt: { $lte: cutoffTime.toISOString() }, 'metrics.view_count': { $exists: true, $gt: 0 }, $or: [{ analyzed: { $exists: false } }, { analyzed: false }]}).sort({ createdAt: -1 }).lean<ITweet[]>();      
    return tweets;
  } 
  catch (error) {console.error('Error fetching tweets for analysis:', error); return [];}
}

export async function getRecentNewsContext(newsTweets: TrackedProfileTweet[]): Promise<string> {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTweets = newsTweets.filter(tweet => {const tweetDate = new Date(tweet.createdAt); return tweetDate >= cutoffTime;});
  const sortedByEngagement = recentTweets.sort((a, b) => (b.metrics.like_count + b.metrics.retweet_count) - (a.metrics.like_count + a.metrics.retweet_count));
  const candidates = sortedByEngagement.slice(0, 30);
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  const context = shuffled.slice(0, 15).map(tweet => `NEWS TWEET ID: ${tweet.id}\nFrom: @${tweet.author}\nContent: "${tweet.text}"\nPosted: ${new Date(tweet.createdAt).toLocaleString()}\n---\n`).join('\n\n');
  return context || 'No recent news available';
}

export async function ingest0xMetaLightTweets() {
  try {const result = await fetchLatestTweets(20); if (result.errors.length > 0) {console.log('   Errors encountered:', result.errors);}} 
  catch (error) {console.error('Error ingesting 0xMetaLight tweets:', error);}
}

export interface I0xMetaLightTweet {
  id: string;
  text: string;
  createdAt: string;
  metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    view_count: number;
  };
  author: {
    id?: string;
    username: string;
    name?: string;
    verified?: boolean;
    followers_count: number;
    following_count: number;
  };
  followerCount: number;
  fetchedAt?: Date;
}

export type OXMetaLightSortBy = 'createdAt' | 'likes' | 'comments' | 'retweets' | 'quotes' | 'views' | 'engagement';
export type OXMetaLightSortOrder = 'asc' | 'desc';

export interface Fetch0xMetaLightTweetsOptions {
  limit?: number;
  sortBy?: OXMetaLightSortBy;
  sortOrder?: OXMetaLightSortOrder;
}

const OXMETALIGHT_SORT_FIELD_MAP: Record<OXMetaLightSortBy, string> = {
  createdAt: 'createdAt',
  likes: 'metrics.like_count',
  comments: 'metrics.reply_count',
  retweets: 'metrics.retweet_count',
  quotes: 'metrics.quote_count',
  views: 'metrics.view_count',
  engagement: 'performance.engagement_rate'
};

function normalize0xMetaLightFetchOptions(options: Fetch0xMetaLightTweetsOptions): Required<Fetch0xMetaLightTweetsOptions> {
  const safeLimit = Math.min(Math.max(Math.floor(options.limit || 20), 1), 500);
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  return { limit: safeLimit, sortBy, sortOrder };
}

export async function fetch0xMetaLightTweetsFromDb(options: number | Fetch0xMetaLightTweetsOptions = 20): Promise<I0xMetaLightTweet[]> {
  try {
    const normalizedInput = typeof options === 'number' ? { limit: options } : options;
    const { limit, sortBy, sortOrder } = normalize0xMetaLightFetchOptions(normalizedInput);
    const sortField = OXMETALIGHT_SORT_FIELD_MAP[sortBy];
    const sortDirection: 1 | -1 = sortOrder === 'asc' ? 1 : -1;
    const sortSpec: Record<string, 1 | -1> = { [sortField]: sortDirection };
    if (sortField !== 'createdAt') {sortSpec.createdAt = -1;}
    const tweets = await Tweets.find({ 'author.username': USER_PROFILE }).sort(sortSpec).limit(limit).lean<ITweet[]>();
    return tweets.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.createdAt,
      metrics: {
        like_count: tweet.metrics?.like_count || 0,
        retweet_count: tweet.metrics?.retweet_count || 0,
        reply_count: tweet.metrics?.reply_count || 0,
        quote_count: tweet.metrics?.quote_count || 0,
        view_count: tweet.metrics?.view_count || 0
      },
      author: {
        id: tweet.author?.id,
        username: tweet.author?.username || USER_PROFILE,
        name: tweet.author?.name,
        verified: tweet.author?.verified || false,
        followers_count: tweet.author?.followers_count || 0,
        following_count: tweet.author?.following_count || 0
      },
      followerCount: tweet.author?.followers_count || 0,
      fetchedAt: tweet.source?.fetched_at
    }));
  } 
  catch (error) {console.error('Error fetching 0xMetaLight tweets from database:', error); return [];}
}

export async function fetchNewsTweetsFromDb(): Promise<TrackedProfileTweet[]> {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newsProfiles = X_TRACKING.filter(account => account.type === 'news').map(account => account.profile);
    const tweets = await Tweets.find({'author.username': { $in: newsProfiles }, 'source.fetched_at': { $gte: cutoffTime }}).sort({ 'source.fetched_at': -1 }).limit(100).lean<ITweet[]>();
    const trackedTweets: TrackedProfileTweet[] = tweets.map(tweet => ({id: tweet.id, text: tweet.text, author: tweet.author.username, createdAt: tweet.createdAt, metrics: {like_count: tweet.metrics?.like_count || 0, retweet_count: tweet.metrics?.retweet_count || 0, view_count: tweet.metrics?.view_count || 0}}));
    return trackedTweets;
  } 
  catch (error) {console.error('Error fetching news tweets from database:', error); return [];}
}
