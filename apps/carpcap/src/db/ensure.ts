// Keep this DDL aligned with src/db/schema.ts. Tables are created on connect.
// Dates are unix milliseconds. JSON values are text. Booleans are 0 or 1.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS prices (
  id text PRIMARY KEY,
  timestamp integer NOT NULL,
  token text NOT NULL,
  address text NOT NULL,
  price real NOT NULL,
  source text NOT NULL,
  chain text NOT NULL,
  confidence_level text,
  bid_ask_spread real,
  spread_percentage real,
  liquidity_score real,
  price_impact_10 real,
  price_impact_100 real,
  price_impact_1000 real,
  is_liquid integer,
  is_stale integer,
  last_swap_age real,
  extra_info text
);
CREATE INDEX IF NOT EXISTS prices_chain_token_timestamp_idx ON prices (chain, token, timestamp);
CREATE INDEX IF NOT EXISTS prices_timestamp_idx ON prices (timestamp);

CREATE TABLE IF NOT EXISTS trades (
  id text PRIMARY KEY,
  trade_id text NOT NULL UNIQUE,
  strategy text DEFAULT 'Unified',
  token text NOT NULL,
  action text NOT NULL,
  side text NOT NULL,
  amount real NOT NULL,
  price real NOT NULL,
  timestamp integer NOT NULL,
  chain text NOT NULL,
  position_size real,
  average_entry_price real,
  entry_timestamp integer,
  pnl real,
  pnl_percentage real,
  holding_period_seconds real,
  is_stop_loss integer DEFAULT 0,
  is_take_profit integer DEFAULT 0,
  session_id text,
  portfolio_value_before real,
  portfolio_value_after real
);
CREATE INDEX IF NOT EXISTS trades_chain_token_timestamp_idx ON trades (chain, token, timestamp);
CREATE INDEX IF NOT EXISTS trades_session_idx ON trades (session_id);

CREATE TABLE IF NOT EXISTS trading_sessions (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  chain text NOT NULL,
  type text NOT NULL,
  start_time integer NOT NULL,
  end_time integer,
  initial_balance real NOT NULL,
  final_balance real,
  total_trades integer NOT NULL DEFAULT 0,
  profitable_trades integer NOT NULL DEFAULT 0,
  total_pnl real NOT NULL DEFAULT 0,
  max_drawdown real NOT NULL DEFAULT 0,
  strategies_tested text NOT NULL DEFAULT '["Unified"]',
  tokens_traded text NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active',
  session_notes text,
  market_conditions text
);
CREATE INDEX IF NOT EXISTS trading_sessions_chain_type_status_idx ON trading_sessions (chain, type, status);

CREATE TABLE IF NOT EXISTS news_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL,
  url text,
  published_at integer NOT NULL,
  description text,
  content text,
  type text NOT NULL DEFAULT 'news',
  impact text NOT NULL DEFAULT 'medium',
  coin text,
  priority text,
  kind text,
  votes text,
  source_type text NOT NULL,
  scraped_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS news_items_published_at_idx ON news_items (published_at);
CREATE INDEX IF NOT EXISTS news_items_url_idx ON news_items (url);
CREATE INDEX IF NOT EXISTS news_items_source_type_idx ON news_items (source_type);

CREATE TABLE IF NOT EXISTS rental_listings (
  id text PRIMARY KEY,
  source text NOT NULL,
  criteria_key text NOT NULL,
  criteria_name text NOT NULL,
  listing_id text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  search_url text NOT NULL,
  area_url text NOT NULL,
  search_path text NOT NULL,
  location_text text,
  price real,
  price_text text,
  bedrooms real,
  square_feet real,
  latitude real,
  longitude real,
  posted_at integer NOT NULL,
  first_seen_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  last_seen_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  notified_at integer,
  status text NOT NULL DEFAULT 'active',
  image_ids text NOT NULL DEFAULT '[]',
  raw text,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (source, criteria_key, listing_id)
);
CREATE INDEX IF NOT EXISTS rental_listings_status_posted_idx ON rental_listings (criteria_key, status, posted_at);

CREATE TABLE IF NOT EXISTS governance_proposals (
  id text PRIMARY KEY,
  proposal_id text NOT NULL UNIQUE,
  owner text NOT NULL,
  repo text NOT NULL,
  branch text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  last_commit_sha text NOT NULL,
  last_commit_date integer NOT NULL,
  last_commit_author text NOT NULL,
  proposal_number text,
  title text,
  status text,
  author text,
  created integer,
  type text,
  category text,
  content text NOT NULL,
  content_markdown text NOT NULL,
  summary text,
  motivation text,
  specification text,
  github_url text NOT NULL,
  raw_url text NOT NULL,
  first_seen_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  last_updated_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  notified integer NOT NULL DEFAULT 0,
  update_count integer NOT NULL DEFAULT 0,
  csv_headers text,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS governance_proposals_repo_idx ON governance_proposals (owner, repo, last_updated_at);
CREATE INDEX IF NOT EXISTS governance_proposals_status_idx ON governance_proposals (status);

CREATE TABLE IF NOT EXISTS governance_repo_checks (
  id text PRIMARY KEY,
  owner text NOT NULL,
  repo text NOT NULL,
  branch text NOT NULL,
  last_check_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  last_commit_sha text,
  last_commit_date integer,
  proposal_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (owner, repo, branch)
);

CREATE TABLE IF NOT EXISTS portfolio_wallets (
  id text PRIMARY KEY,
  name text NOT NULL,
  address text NOT NULL,
  netuid integer NOT NULL,
  subnet_name text NOT NULL,
  UNIQUE (address, netuid)
);

CREATE TABLE IF NOT EXISTS portfolio_states (
  key text PRIMARY KEY,
  last_snapshot text
);

CREATE TABLE IF NOT EXISTS tweets (
  id text PRIMARY KEY,
  text text NOT NULL,
  created_at text NOT NULL,
  published_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  last_updated integer NOT NULL DEFAULT (unixepoch() * 1000),
  is_reply integer NOT NULL DEFAULT 0,
  in_reply_to_id text,
  in_reply_to_username text,
  conversation_id text,
  metrics text,
  urls text,
  media text,
  author text,
  analysis text,
  performance text,
  source text,
  analyzed integer NOT NULL DEFAULT 0,
  analyzed_at integer,
  analysis_results text,
  created_at_row integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS tweets_created_at_idx ON tweets (created_at);
CREATE INDEX IF NOT EXISTS tweets_analyzed_idx ON tweets (analyzed);
CREATE INDEX IF NOT EXISTS tweets_author_username_idx ON tweets (json_extract(author, '$.username'));

CREATE TABLE IF NOT EXISTS scraped_tweets (
  id text PRIMARY KEY,
  tweet text,
  created_at text,
  metrics text,
  permalink text,
  quoted_tweet text,
  screen_name text,
  scraped_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
`;

export async function ensureSchema(execute: (statement: string) => Promise<void>): Promise<void> {
  const statements = SCHEMA_SQL.split(/;\s*\n/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    await execute(statement.endsWith(';') ? statement : `${statement};`);
  }
}
