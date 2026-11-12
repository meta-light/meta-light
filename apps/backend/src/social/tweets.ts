import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { ITweet } from '../utils/twitter/schema';
import { connectDatabase, getDb } from '../database/client';
import {
  tweets,
  type TweetAuthor,
  type TweetMetrics,
  type TweetPerformance,
  type TweetSource,
} from './schema';

type TweetRow = typeof tweets.$inferSelect;

const EMPTY_METRICS: TweetMetrics = {
  like_count: 0,
  retweet_count: 0,
  reply_count: 0,
  quote_count: 0,
  view_count: 0,
};

function asDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function toTweet(row: TweetRow): ITweet {
  const metrics = row.metrics ?? EMPTY_METRICS;
  const views = metrics.view_count || 0;
  const engagements =
    (metrics.like_count || 0) +
    (metrics.retweet_count || 0) +
    (metrics.reply_count || 0) +
    (metrics.quote_count || 0);
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    lastUpdated: row.lastUpdated,
    isReply: row.isReply,
    inReplyToId: row.inReplyToId ?? undefined,
    inReplyToUsername: row.inReplyToUsername ?? undefined,
    conversationId: row.conversationId ?? undefined,
    metrics,
    urls: row.urls ?? [],
    media: row.media ?? [],
    author: row.author ?? {
      id: '',
      username: '',
      name: '',
      verified: false,
      followers_count: 0,
      following_count: 0,
    },
    analysis: row.analysis ?? {},
    performance: row.performance ?? {
      engagement_rate: 0,
      performance_score: 0,
      viral_potential: 0,
    },
    source: {
      api: row.source?.api ?? 'twitterapi.io',
      fetched_at: asDate(row.source?.fetched_at) ?? row.publishedAt,
      processed: row.source?.processed ?? false,
      processing_errors: row.source?.processing_errors ?? [],
    },
    analyzed: row.analyzed,
    analyzedAt: row.analyzedAt ?? undefined,
    analysisResults: (row.analysisResults ??
      undefined) as ITweet['analysisResults'],
    calculated_engagement_rate: views > 0 ? engagements / views : 0,
  };
}

function engagementRate(metrics: TweetMetrics | undefined): number {
  const views = metrics?.view_count || 0;
  if (views <= 0) return 0;
  const engagements =
    (metrics?.like_count || 0) +
    (metrics?.retweet_count || 0) +
    (metrics?.reply_count || 0) +
    (metrics?.quote_count || 0);
  return engagements / views;
}

const viewCountSql = sql`COALESCE(CAST(json_extract(${tweets.metrics}, '$.view_count') AS REAL), 0)`;
const likeCountSql = sql`COALESCE(CAST(json_extract(${tweets.metrics}, '$.like_count') AS REAL), 0)`;
const retweetCountSql = sql`COALESCE(CAST(json_extract(${tweets.metrics}, '$.retweet_count') AS REAL), 0)`;
const replyCountSql = sql`COALESCE(CAST(json_extract(${tweets.metrics}, '$.reply_count') AS REAL), 0)`;
const quoteCountSql = sql`COALESCE(CAST(json_extract(${tweets.metrics}, '$.quote_count') AS REAL), 0)`;
const engagementSql = sql`CASE
  WHEN COALESCE(CAST(json_extract(${tweets.performance}, '$.engagement_rate') AS REAL), 0) > 0
    THEN CAST(json_extract(${tweets.performance}, '$.engagement_rate') AS REAL)
  WHEN ${viewCountSql} > 0
    THEN (${likeCountSql} + ${retweetCountSql} + ${replyCountSql} + ${quoteCountSql}) / ${viewCountSql}
  ELSE 0
END`;

export type TweetSortBy =
  | 'createdAt'
  | 'likes'
  | 'comments'
  | 'retweets'
  | 'quotes'
  | 'views'
  | 'engagement';

function sortExpression(sortBy: TweetSortBy): SQL {
  switch (sortBy) {
    case 'likes':
      return likeCountSql;
    case 'comments':
      return replyCountSql;
    case 'retweets':
      return retweetCountSql;
    case 'quotes':
      return quoteCountSql;
    case 'views':
      return viewCountSql;
    case 'engagement':
      return engagementSql;
    default:
      return sql`${tweets.createdAt}`;
  }
}

export async function findTweetsByAuthor(options: {
  username: string;
  limit: number;
  sortBy?: TweetSortBy;
  sortOrder?: 'asc' | 'desc';
  minViews?: boolean;
  createdAtGte?: string;
}): Promise<ITweet[]> {
  await connectDatabase();
  const filters = [
    sql`json_extract(${tweets.author}, '$.username') = ${options.username}`,
  ];
  if (options.minViews) filters.push(sql`${viewCountSql} > 0`);
  if (options.createdAtGte)
    filters.push(gte(tweets.createdAt, options.createdAtGte));
  const direction = options.sortOrder === 'asc' ? asc : desc;
  const primary = direction(sortExpression(options.sortBy ?? 'createdAt'));
  const rows = await getDb()
    .select()
    .from(tweets)
    .where(and(...filters))
    .orderBy(
      primary,
      options.sortBy && options.sortBy !== 'createdAt'
        ? desc(tweets.createdAt)
        : desc(tweets.createdAt),
    )
    .limit(options.limit);
  return rows.map(toTweet);
}

export async function findUnanalyzedTweets(
  createdAtLte: string,
): Promise<ITweet[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(tweets)
    .where(
      and(
        lte(tweets.createdAt, createdAtLte),
        sql`${viewCountSql} > 0`,
        eq(tweets.analyzed, false),
      ),
    )
    .orderBy(desc(tweets.createdAt));
  return rows.map(toTweet);
}

export async function findNewsProfileTweets(
  usernames: string[],
  fetchedSince: Date,
  limit = 100,
): Promise<ITweet[]> {
  if (usernames.length === 0) return [];
  await connectDatabase();
  const usernameList = sql.join(
    usernames.map((username) => sql`${username}`),
    sql`, `,
  );
  const fetchedOrPublished = sql`COALESCE(CAST(strftime('%s', substr(json_extract(${tweets.source}, '$.fetched_at'), 1, 19)) AS INTEGER) * 1000, ${tweets.publishedAt})`;
  const rows = await getDb()
    .select()
    .from(tweets)
    .where(
      and(
        sql`json_extract(${tweets.author}, '$.username') in (${usernameList})`,
        sql`${fetchedOrPublished} >= ${fetchedSince.getTime()}`,
      ),
    )
    .orderBy(sql`${fetchedOrPublished} DESC`)
    .limit(limit);
  return rows.map(toTweet);
}

export async function findTopTweetsByEngagement(
  createdAtGte: string,
  limit: number,
): Promise<ITweet[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(tweets)
    .where(and(gte(tweets.createdAt, createdAtGte), sql`${viewCountSql} > 0`))
    .orderBy(desc(engagementSql))
    .limit(limit);
  return rows.map(toTweet);
}

export async function upsertTweets(
  inputs: Partial<ITweet>[],
): Promise<{ newTweets: number; updatedTweets: number }> {
  const rows = inputs.filter(
    (tweet): tweet is Partial<ITweet> & { id: string; text: string } =>
      Boolean(tweet.id && tweet.text),
  );
  if (rows.length === 0) return { newTweets: 0, updatedTweets: 0 };
  await connectDatabase();
  const ids = rows.map((row) => row.id);
  const existingIds = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 80) {
    const existing = await getDb()
      .select({ id: tweets.id })
      .from(tweets)
      .where(inArray(tweets.id, ids.slice(offset, offset + 80)));
    for (const row of existing) existingIds.add(row.id);
  }
  let newTweets = 0;
  let updatedTweets = 0;
  for (const tweet of rows) {
    const metrics = tweet.metrics ?? EMPTY_METRICS;
    const performance: TweetPerformance = {
      engagement_rate: engagementRate(metrics),
      performance_score: tweet.performance?.performance_score ?? 0,
      viral_potential: tweet.performance?.viral_potential ?? 0,
      last_metrics_update: tweet.performance?.last_metrics_update ?? new Date(),
    };
    const author = tweet.author as TweetAuthor | undefined;
    const source = tweet.source as TweetSource | undefined;
    const isNew = !existingIds.has(tweet.id);
    await getDb()
      .insert(tweets)
      .values({
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.createdAt ?? new Date().toISOString(),
        publishedAt: tweet.publishedAt ?? new Date(),
        lastUpdated: new Date(),
        isReply: tweet.isReply ?? false,
        inReplyToId: tweet.inReplyToId,
        inReplyToUsername: tweet.inReplyToUsername,
        conversationId: tweet.conversationId,
        metrics,
        urls: tweet.urls ?? [],
        media: tweet.media ?? [],
        author,
        analysis: tweet.analysis,
        performance,
        source,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tweets.id,
        set: {
          text: tweet.text,
          createdAt: tweet.createdAt ?? new Date().toISOString(),
          lastUpdated: new Date(),
          isReply: tweet.isReply ?? false,
          inReplyToId: tweet.inReplyToId,
          inReplyToUsername: tweet.inReplyToUsername,
          conversationId: tweet.conversationId,
          metrics,
          urls: tweet.urls ?? [],
          media: tweet.media ?? [],
          author,
          analysis: tweet.analysis,
          performance,
          source,
          updatedAt: new Date(),
        },
      });
    if (isNew) newTweets += 1;
    else updatedTweets += 1;
  }
  return { newTweets, updatedTweets };
}
