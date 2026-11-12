import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const tweets = sqliteTable(
  'tweets',
  {
    id: text('id').primaryKey(),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUpdated: integer('last_updated', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    isReply: integer('is_reply', { mode: 'boolean' }).notNull().default(false),
    inReplyToId: text('in_reply_to_id'),
    inReplyToUsername: text('in_reply_to_username'),
    conversationId: text('conversation_id'),
    metrics: text('metrics', { mode: 'json' }).$type<TweetMetrics>(),
    urls: text('urls', { mode: 'json' }).$type<string[]>(),
    media: text('media', { mode: 'json' }).$type<TweetMedia[]>(),
    author: text('author', { mode: 'json' }).$type<TweetAuthor>(),
    analysis: text('analysis', { mode: 'json' }).$type<TweetAnalysis>(),
    performance: text('performance', {
      mode: 'json',
    }).$type<TweetPerformance>(),
    source: text('source', { mode: 'json' }).$type<TweetSource>(),
    analyzed: integer('analyzed', { mode: 'boolean' }).notNull().default(false),
    analyzedAt: integer('analyzed_at', { mode: 'timestamp_ms' }),
    analysisResults: text('analysis_results', { mode: 'json' }),
    createdAtRow: integer('created_at_row', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('tweets_created_at_idx').on(table.createdAt),
    index('tweets_analyzed_idx').on(table.analyzed),
  ],
);

export const scrapedTweets = sqliteTable('scraped_tweets', {
  id: text('id').primaryKey(),
  tweet: text('tweet'),
  createdAt: text('created_at'),
  metrics: text('metrics', { mode: 'json' }),
  permalink: text('permalink'),
  quotedTweet: text('quoted_tweet', { mode: 'json' }),
  screenName: text('screen_name'),
  scrapedAt: integer('scraped_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export interface TweetMetrics {
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  view_count: number;
}

export interface TweetMedia {
  type: string;
  url: string;
  media_url: string;
}

export interface TweetAuthor {
  id: string;
  username: string;
  name: string;
  verified: boolean;
  followers_count: number;
  following_count: number;
}

export interface TweetAnalysis {
  sentiment?: string;
  topics?: string[];
  hashtags?: string[];
  mentions?: string[];
  language?: string;
  word_count?: number;
  character_count?: number;
}

export interface TweetPerformance {
  engagement_rate: number;
  performance_score: number;
  viral_potential: number;
  last_metrics_update?: Date | string;
}

export interface TweetSource {
  api?: string;
  fetched_at?: Date | string;
  processed?: boolean;
  processing_errors?: string[];
}
