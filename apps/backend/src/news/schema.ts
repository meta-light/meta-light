import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const newsItems = sqliteTable(
  'news_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    source: text('source').notNull(),
    url: text('url'),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
    description: text('description'),
    content: text('content'),
    type: text('type').notNull().default('news'),
    impact: text('impact').notNull().default('medium'),
    coin: text('coin'),
    priority: text('priority'),
    kind: text('kind'),
    votes: text('votes', { mode: 'json' }).$type<{
      negative?: number;
      positive?: number;
      important?: number;
    }>(),
    sourceType: text('source_type').notNull(),
    scrapedAt: integer('scraped_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('news_items_published_at_idx').on(table.publishedAt),
    index('news_items_url_idx').on(table.url),
    index('news_items_source_type_idx').on(table.sourceType),
  ],
);
