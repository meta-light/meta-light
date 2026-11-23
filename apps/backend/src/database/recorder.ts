import type { Sql } from './sql';

export const RECORDER_SQL = `
CREATE TABLE IF NOT EXISTS crypto_bars (
  source text NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  open_time integer NOT NULL,
  open real NOT NULL,
  high real NOT NULL,
  low real NOT NULL,
  close real NOT NULL,
  volume real NOT NULL,
  PRIMARY KEY (source, symbol, interval, open_time)
);

CREATE TABLE IF NOT EXISTS weather_events (
  venue text NOT NULL,
  event_id text NOT NULL,
  city text NOT NULL,
  date text NOT NULL,
  close_ms integer NOT NULL,
  fee real NOT NULL,
  buckets text NOT NULL,
  results text,
  settled_high real,
  updated_at integer NOT NULL,
  PRIMARY KEY (venue, event_id)
);
CREATE INDEX IF NOT EXISTS weather_events_date_idx ON weather_events (date);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  venue text NOT NULL,
  event_id text NOT NULL,
  t integer NOT NULL,
  quotes text NOT NULL,
  PRIMARY KEY (venue, event_id, t)
);

CREATE TABLE IF NOT EXISTS weather_forecasts (
  station text NOT NULL,
  t integer NOT NULL,
  hourly text NOT NULL,
  PRIMARY KEY (station, t)
);

CREATE TABLE IF NOT EXISTS weather_obs (
  station text NOT NULL,
  t integer NOT NULL,
  temp_c real,
  raw text NOT NULL,
  PRIMARY KEY (station, t)
);

CREATE TABLE IF NOT EXISTS fetch_cache (
  key text NOT NULL,
  part integer NOT NULL,
  parts integer NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (key, part)
);

CREATE TABLE IF NOT EXISTS collector_runs (
  job text NOT NULL,
  t integer NOT NULL,
  ok integer NOT NULL,
  rows integer NOT NULL,
  ms integer NOT NULL,
  error text,
  PRIMARY KEY (job, t)
);

CREATE TABLE IF NOT EXISTS nock_merge_mining (
  day text PRIMARY KEY,
  t integer NOT NULL,
  tip_height integer NOT NULL,
  h24_pearl_blocks integer NOT NULL,
  h24_tagged integer NOT NULL,
  h24_matched integer NOT NULL,
  h24_share real NOT NULL,
  d7_pearl_blocks integer NOT NULL,
  d7_tagged integer NOT NULL,
  d7_matched integer NOT NULL,
  d7_share real NOT NULL,
  declared_total_ai integer NOT NULL,
  declared_declared_ai integer NOT NULL,
  declared_share real NOT NULL,
  window2016_total_ai integer NOT NULL,
  window2016_declared_ai integer NOT NULL,
  window2016_share real NOT NULL,
  pearl_tagged_blocks integer NOT NULL,
  pearl_matched_pairs integer NOT NULL,
  miner_count integer NOT NULL
);

CREATE TABLE IF NOT EXISTS nock_merge_miners (
  day text NOT NULL,
  address text NOT NULL,
  t integer NOT NULL,
  tip_height integer NOT NULL,
  declared_24h integer NOT NULL,
  landed_24h integer NOT NULL,
  declared_7d integer NOT NULL,
  landed_7d integer NOT NULL,
  PRIMARY KEY (day, address)
);

CREATE TABLE IF NOT EXISTS paper_weather_trades (
  strategy text NOT NULL,
  venue text NOT NULL,
  city text NOT NULL,
  date text NOT NULL,
  bucket text NOT NULL,
  side text NOT NULL,
  t integer NOT NULL,
  price real NOT NULL,
  contracts real NOT NULL,
  fee real NOT NULL,
  pnl real NOT NULL,
  won integer NOT NULL,
  PRIMARY KEY (strategy, venue, bucket, side, t)
);

CREATE TABLE IF NOT EXISTS paper_stats (
  domain text NOT NULL,
  strategy text NOT NULL,
  scope text NOT NULL,
  day text NOT NULL,
  since text NOT NULL,
  trades integer NOT NULL,
  pnl real,
  roi real,
  total_return real,
  hold_return real,
  win_rate real,
  max_drawdown real,
  sharpe real,
  updated_at integer NOT NULL,
  PRIMARY KEY (domain, strategy, scope, day)
);
`;

export const recorderStatements = (): string[] =>
  RECORDER_SQL.split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

let ensured: Promise<void> | null = null;

export function ensureRecorder(sql: Sql): Promise<void> {
  ensured ??= (async () => {
    for (const s of recorderStatements()) await sql.run(s);
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}
