import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ITweet } from '@meta-light/utils/twitter-api';

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
    metrics: text('metrics', { mode: 'json' }).$type<ITweet['metrics']>(),
    urls: text('urls', { mode: 'json' }).$type<string[]>(),
    media: text('media', { mode: 'json' }).$type<ITweet['media']>(),
    author: text('author', { mode: 'json' }).$type<ITweet['author']>(),
    analysis: text('analysis', { mode: 'json' }).$type<ITweet['analysis']>(),
    performance: text('performance', {
      mode: 'json',
    }).$type<ITweet['performance']>(),
    source: text('source', { mode: 'json' }).$type<ITweet['source']>(),
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
