// Keep this DDL aligned with the service schema files. Tables are created on connect.
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

export async function ensureSchema(
  execute: (statement: string) => Promise<void>,
): Promise<void> {
  const statements = SCHEMA_SQL.split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await execute(statement.endsWith(';') ? statement : `${statement};`);
  }
}
