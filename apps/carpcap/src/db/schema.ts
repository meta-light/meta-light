import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());

export const prices = sqliteTable('prices', {
  id: id(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull(),
  address: text('address').notNull(),
  price: real('price').notNull(),
  source: text('source').notNull(),
  chain: text('chain').notNull(),
  confidenceLevel: text('confidence_level'),
  bidAskSpread: real('bid_ask_spread'),
  spreadPercentage: real('spread_percentage'),
  liquidityScore: real('liquidity_score'),
  priceImpact10: real('price_impact_10'),
  priceImpact100: real('price_impact_100'),
  priceImpact1000: real('price_impact_1000'),
  isLiquid: integer('is_liquid', { mode: 'boolean' }),
  isStale: integer('is_stale', { mode: 'boolean' }),
  lastSwapAge: real('last_swap_age'),
  extraInfo: text('extra_info', { mode: 'json' }),
}, (table) => [
  index('prices_chain_token_timestamp_idx').on(table.chain, table.token, table.timestamp),
  index('prices_timestamp_idx').on(table.timestamp),
]);

export const trades = sqliteTable('trades', {
  id: id(),
  tradeId: text('trade_id').notNull(),
  strategy: text('strategy').default('Unified'),
  token: text('token').notNull(),
  action: text('action').notNull(),
  side: text('side').notNull(),
  amount: real('amount').notNull(),
  price: real('price').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  chain: text('chain').notNull(),
  positionSize: real('position_size'),
  averageEntryPrice: real('average_entry_price'),
  entryTimestamp: integer('entry_timestamp', { mode: 'timestamp_ms' }),
  pnl: real('pnl'),
  pnlPercentage: real('pnl_percentage'),
  holdingPeriodSeconds: real('holding_period_seconds'),
  isStopLoss: integer('is_stop_loss', { mode: 'boolean' }).default(false),
  isTakeProfit: integer('is_take_profit', { mode: 'boolean' }).default(false),
  sessionId: text('session_id'),
  portfolioValueBefore: real('portfolio_value_before'),
  portfolioValueAfter: real('portfolio_value_after'),
}, (table) => [
  uniqueIndex('trades_trade_id_idx').on(table.tradeId),
  index('trades_chain_token_timestamp_idx').on(table.chain, table.token, table.timestamp),
  index('trades_session_idx').on(table.sessionId),
]);

export const tradingSessions = sqliteTable('trading_sessions', {
  id: id(),
  sessionId: text('session_id').notNull(),
  chain: text('chain').notNull(),
  type: text('type').notNull(),
  startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp_ms' }),
  initialBalance: real('initial_balance').notNull(),
  finalBalance: real('final_balance'),
  totalTrades: integer('total_trades').notNull().default(0),
  profitableTrades: integer('profitable_trades').notNull().default(0),
  totalPnl: real('total_pnl').notNull().default(0),
  maxDrawdown: real('max_drawdown').notNull().default(0),
  strategiesTested: text('strategies_tested', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => ['Unified']),
  tokensTraded: text('tokens_traded', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  status: text('status').notNull().default('active'),
  sessionNotes: text('session_notes'),
  marketConditions: text('market_conditions', { mode: 'json' }),
}, (table) => [
  uniqueIndex('trading_sessions_session_id_idx').on(table.sessionId),
  index('trading_sessions_chain_type_status_idx').on(table.chain, table.type, table.status),
]);

export const newsItems = sqliteTable('news_items', {
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
  votes: text('votes', { mode: 'json' }).$type<{ negative?: number; positive?: number; important?: number }>(),
  sourceType: text('source_type').notNull(),
  scrapedAt: integer('scraped_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('news_items_published_at_idx').on(table.publishedAt),
  index('news_items_url_idx').on(table.url),
  index('news_items_source_type_idx').on(table.sourceType),
]);

export const rentalListings = sqliteTable('rental_listings', {
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
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  notifiedAt: integer('notified_at', { mode: 'timestamp_ms' }),
  status: text('status').notNull().default('active'),
  imageIds: text('image_ids', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  raw: text('raw', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('rental_listings_identity_idx').on(table.source, table.criteriaKey, table.listingId),
  index('rental_listings_status_posted_idx').on(table.criteriaKey, table.status, table.postedAt),
]);

export const governanceProposals = sqliteTable('governance_proposals', {
  id: id(),
  proposalId: text('proposal_id').notNull(),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  lastCommitSha: text('last_commit_sha').notNull(),
  lastCommitDate: integer('last_commit_date', { mode: 'timestamp_ms' }).notNull(),
  lastCommitAuthor: text('last_commit_author').notNull(),
  proposalNumber: text('proposal_number'),
  title: text('title'),
  status: text('status'),
  author: text('author'),
  created: integer('created', { mode: 'timestamp_ms' }),
  type: text('type'),
  category: text('category'),
  content: text('content').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  summary: text('summary'),
  motivation: text('motivation'),
  specification: text('specification'),
  githubUrl: text('github_url').notNull(),
  rawUrl: text('raw_url').notNull(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
  updateCount: integer('update_count').notNull().default(0),
  csvHeaders: text('csv_headers', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('governance_proposals_proposal_id_idx').on(table.proposalId),
  index('governance_proposals_repo_idx').on(table.owner, table.repo, table.lastUpdatedAt),
  index('governance_proposals_status_idx').on(table.status),
]);

export const governanceRepoChecks = sqliteTable('governance_repo_checks', {
  id: id(),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
  lastCheckAt: integer('last_check_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  lastCommitSha: text('last_commit_sha'),
  lastCommitDate: integer('last_commit_date', { mode: 'timestamp_ms' }),
  proposalCount: integer('proposal_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('governance_repo_checks_identity_idx').on(table.owner, table.repo, table.branch),
]);

export const portfolioWallets = sqliteTable('portfolio_wallets', {
  id: id(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  netuid: integer('netuid').notNull(),
  subnetName: text('subnet_name').notNull(),
}, (table) => [
  uniqueIndex('portfolio_wallets_address_netuid_idx').on(table.address, table.netuid),
]);

export const portfolioStates = sqliteTable('portfolio_states', {
  key: text('key').primaryKey(),
  lastSnapshot: text('last_snapshot', { mode: 'json' }),
});

export const tweets = sqliteTable('tweets', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  lastUpdated: integer('last_updated', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  isReply: integer('is_reply', { mode: 'boolean' }).notNull().default(false),
  inReplyToId: text('in_reply_to_id'),
  inReplyToUsername: text('in_reply_to_username'),
  conversationId: text('conversation_id'),
  metrics: text('metrics', { mode: 'json' }).$type<TweetMetrics>(),
  urls: text('urls', { mode: 'json' }).$type<string[]>(),
  media: text('media', { mode: 'json' }).$type<TweetMedia[]>(),
  author: text('author', { mode: 'json' }).$type<TweetAuthor>(),
  analysis: text('analysis', { mode: 'json' }).$type<TweetAnalysis>(),
  performance: text('performance', { mode: 'json' }).$type<TweetPerformance>(),
  source: text('source', { mode: 'json' }).$type<TweetSource>(),
  analyzed: integer('analyzed', { mode: 'boolean' }).notNull().default(false),
  analyzedAt: integer('analyzed_at', { mode: 'timestamp_ms' }),
  analysisResults: text('analysis_results', { mode: 'json' }),
  createdAtRow: integer('created_at_row', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('tweets_created_at_idx').on(table.createdAt),
  index('tweets_analyzed_idx').on(table.analyzed),
]);

export const scrapedTweets = sqliteTable('scraped_tweets', {
  id: text('id').primaryKey(),
  tweet: text('tweet'),
  createdAt: text('created_at'),
  metrics: text('metrics', { mode: 'json' }),
  permalink: text('permalink'),
  quotedTweet: text('quoted_tweet', { mode: 'json' }),
  screenName: text('screen_name'),
  scrapedAt: integer('scraped_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
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
