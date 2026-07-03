import express from 'express';
import cors from 'cors';
import { NewsModel } from '../news/model';
import mongoose from 'mongoose';
import { fetch0xMetaLightTweetsFromDb, OXMetaLightSortBy, OXMetaLightSortOrder } from '../social/utils';
import { USER_PROFILE } from '../social/config';
import { getRentalListings, syncCraigslistRentals } from '../rentals';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

const validSortBy = new Set<OXMetaLightSortBy>(['createdAt', 'likes', 'comments', 'retweets', 'quotes', 'views', 'engagement']);
const sortByAliases: Record<string, OXMetaLightSortBy> = {
  createdat: 'createdAt',
  date: 'createdAt',
  likes: 'likes',
  like_count: 'likes',
  comments: 'comments',
  comment_count: 'comments',
  replies: 'comments',
  reply_count: 'comments',
  retweets: 'retweets',
  retweet_count: 'retweets',
  quotes: 'quotes',
  quote_count: 'quotes',
  views: 'views',
  view_count: 'views',
  engagement: 'engagement',
  engagement_rate: 'engagement'
};

function parseLimit(value: unknown, fallback = 20): number {
  if (typeof value !== 'string') return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function parseSortBy(value: unknown): OXMetaLightSortBy {
  if (typeof value !== 'string') return 'createdAt';
  const normalized = value.trim().toLowerCase();
  const aliasMatch = sortByAliases[normalized];
  if (aliasMatch) return aliasMatch;
  if (validSortBy.has(value as OXMetaLightSortBy)) return value as OXMetaLightSortBy;
  return 'createdAt';
}

function parseSortOrder(value: unknown): OXMetaLightSortOrder {
  if (typeof value !== 'string') return 'desc';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'asc' || normalized === 'lowest' || normalized === 'low') return 'asc';
  if (normalized === 'desc' || normalized === 'highest' || normalized === 'high') return 'desc';
  return 'desc';
}

function parseBoolean(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

app.get('/api/news', async (req, res) => {
  try {const news = await NewsModel.find({}).sort({ publishedAt: -1 }).limit(30).lean(); res.json({success: true, count: news.length, data: news});} 
  catch (error) {console.error('Error fetching news:', error); res.status(500).json({success: false, error: 'Failed to fetch news items'});}
});

app.get('/api/social/0xmetalight', async (req, res) => {
  try {
    const requestedLimit = parseLimit(req.query.limit, 20);
    const sortBy = parseSortBy(req.query.sortBy);
    const sortOrder = parseSortOrder(req.query.sortOrder ?? req.query.order ?? req.query.direction);
    const tweets = await fetch0xMetaLightTweetsFromDb({ limit: requestedLimit, sortBy, sortOrder });
    res.json({
      success: true,
      profile: USER_PROFILE,
      count: tweets.length,
      sort: { by: sortBy, order: sortOrder },
      data: tweets
    });
  } 
  catch (error) {console.error('Error fetching 0xMetaLight tweets:', error); res.status(500).json({success: false, error: 'Failed to fetch 0xMetaLight tweets'});}
});

app.get('/api/rentals', async (req, res) => {
  try {
    const requestedLimit = parseLimit(req.query.limit, 20);
    const status = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'active';
    const sync = parseBoolean(req.query.sync);
    const syncResult = sync ? await syncCraigslistRentals() : null;
    const listings = await getRentalListings({
      criteriaKey: typeof req.query.criteriaKey === 'string' ? req.query.criteriaKey : undefined,
      status: status === 'inactive' ? 'inactive' : status === 'all' ? 'all' : 'active',
      limit: requestedLimit
    });
    res.json({
      success: true,
      count: listings.length,
      sync: syncResult ? {
        criteriaKey: syncResult.criteriaKey,
        searchUrl: syncResult.searchUrl,
        fetched: syncResult.fetched,
        matched: syncResult.matched,
        filteredOut: syncResult.filteredOut,
        created: syncResult.created,
        active: syncResult.active
      } : null,
      data: listings
    });
  }
  catch (error) {console.error('Error fetching rentals:', error); res.status(500).json({success: false, error: 'Failed to fetch rentals'});}
});

const healthCheck = (req: express.Request, res: express.Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mongo: mongoStatus});
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

export function startApiServer() {app.listen(PORT, () => {console.log(`API server running on port ${PORT}`);});}
export default app;
