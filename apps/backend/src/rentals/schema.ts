import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const rentalListings = sqliteTable(
  'rental_listings',
  {
    id: id(),
    source: text('source').notNull(),
    criteriaKey: text('criteria_key').notNull(),
    criteriaName: text('criteria_name').notNull(),
    listingId: text('listing_id').notNull(),
    title: text('title').notNull(),
    url: text('url').notNull(),
    searchUrl: text('search_url').notNull(),
    areaUrl: text('area_url').notNull(),
    searchPath: text('search_path').notNull(),
    locationText: text('location_text'),
    price: real('price'),
    priceText: text('price_text'),
    bedrooms: real('bedrooms'),
    squareFeet: real('square_feet'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    postedAt: integer('posted_at', { mode: 'timestamp_ms' }).notNull(),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    notifiedAt: integer('notified_at', { mode: 'timestamp_ms' }),
    status: text('status').notNull().default('active'),
    imageIds: text('image_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    raw: text('raw', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('rental_listings_identity_idx').on(
      table.source,
      table.criteriaKey,
      table.listingId,
    ),
    index('rental_listings_status_posted_idx').on(
      table.criteriaKey,
      table.status,
      table.postedAt,
    ),
  ],
);
