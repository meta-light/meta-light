import { insertRows, type Sql, upsert } from '../database/sql';
import { toMarketEvent, type EventRow, type SnapshotRow } from '../collect/records';
import { assetsFor, CRYPTO_COSTS, skipReason, summarize, UNIVERSE } from './backtest';
import { createFetchBars } from './data/index';
import { REGISTRY } from './engine/registry';
import { type FetchBars, runStrategy } from './engine/run';
import type { DataBar } from './strategies/engine/index';
import { CITIES, type Venue } from './weather/cities';
import { stats, type FillParams, type Stats, type Trade } from './weather/engine';
import { kalshiEvents } from './weather/kalshi';
import { DEFAULT_MODEL } from './weather/model';
import { polymarketEvents } from './weather/polymarket';
import { backtest, cityData, type VenueData } from './weather/run';
import { explore, lineup } from './weather/strategies';
import { addDays } from './weather/time';
import type { MarketEvent } from './weather/types';

const DAY = 86_400_000;
const WEATHER_WARMUP_DAYS = 120;
const PAPER_FILLS: FillParams = { stake: 10, maxStaleMs: 3_600_000, halfSpread: 0 };
const CAPITAL = 100_000;
const CRYPTO_WARMUP_DAYS: Record<string, number> = { '1d': 400, '1h': 60, '30m': 30, '15m': 30, '5m': 30, '1m': 7 };

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export interface PaperReport {
  start: string;
  day: string;
  weather: { events: number; trades: number; strategies: number; warnings: string[] };
  crypto: { strategies: number; skipped: { strategy: string; reason: string }[] };
}

export async function paperStart(sql: Sql): Promise<string | null> {
  const [row] = await sql.all<{ t: number | null }>('SELECT MIN(t) AS t FROM collector_runs WHERE ok = 1');
  return row?.t ? isoDay(row.t) : null;
}

export async function runPaper(sql: Sql, now = Date.now(), log: (msg: string) => void = () => {}): Promise<PaperReport | null> {
  const start = await paperStart(sql);
  if (!start) return null;
  const day = isoDay(now);
  log(`paper: ${start}..${day}`);
  const weather = await paperWeather(sql, start, now, log);
  const crypto = await paperCrypto(sql, start, now, log);
  return { start, day, weather, crypto };
}

async function recordedEvents(sql: Sql, start: string): Promise<MarketEvent[]> {
  const rows = await sql.all<EventRow>(
    `SELECT venue, event_id, city, date, close_ms, fee, buckets, results, settled_high
     FROM weather_events WHERE results IS NOT NULL AND date >= ? ORDER BY date`,
    [start],
  );
  const out: MarketEvent[] = [];
  for (const e of rows) {
    const snaps = await sql.all<SnapshotRow>(
      'SELECT event_id, t, quotes FROM weather_snapshots WHERE venue = ? AND event_id = ? ORDER BY t',
      [e.venue, e.event_id],
    );
    const ev = toMarketEvent(e, snaps);
    if (ev) out.push(ev);
  }
  return out;
}

async function paperWeather(sql: Sql, start: string, now: number, log: (msg: string) => void): Promise<PaperReport['weather']> {
  const today = isoDay(now);
  const warmFrom = addDays(start, -WEATHER_WARMUP_DAYS);
  const warmTo = addDays(start, -1);
  const recorded = await recordedEvents(sql, start);
  const warnings: string[] = [];
  const venues: VenueData[] = [];
  for (const city of CITIES) {
    for (const venue of ['kalshi', 'polymarket'] as Venue[]) {
      const mine = recorded.filter((e) => e.venue === venue && e.cityId === city.id);
      let history: MarketEvent[] = [];
      try {
        const opts = { since: warmFrom, until: warmTo };
        const { series } = city[venue];
        history = venue === 'kalshi' ? await kalshiEvents(city.id, series, opts) : await polymarketEvents(city.id, series, opts);
      } catch (e) {
        warnings.push(`${venue}:${city.id} warm-up: ${(e as Error).message}`);
      }
      if (!mine.length && !history.length) continue;
      const data = await cityData(venue, city, warmFrom, today);
      const events = [...history.filter((e) => e.date < start), ...mine].sort((a, b) => a.date.localeCompare(b.date));
      venues.push({ venue, city, events, data });
      log(`  ${venue}:${city.id}: ${history.length} warm-up + ${mine.length} recorded events`);
    }
  }
  const strategies = [...lineup(), ...explore()];
  const res = backtest(venues, strategies, DEFAULT_MODEL, PAPER_FILLS, start);
  const trades = res.trades.filter((t) => t.date >= start);

  await insertRows(
    sql,
    'paper_weather_trades',
    TRADE_COLS,
    trades.map((t) => [t.strategy, t.venue, t.cityId, t.date, t.bucket, t.side, t.t, t.price, t.contracts, t.fee, t.pnl, t.won ? 1 : 0]),
    upsert(['strategy', 'venue', 'bucket', 'side', 't'], TRADE_COLS),
  );

  const rows: unknown[][] = [];
  for (const s of strategies) {
    const mine = trades.filter((t) => t.strategy === s.name);
    const scopes = new Map<string, Trade[]>([['all', mine]]);
    for (const t of mine) {
      for (const key of [t.venue, `${t.venue}:${t.cityId}`]) scopes.set(key, [...(scopes.get(key) ?? []), t]);
    }
    for (const [scope, ts] of scopes) rows.push(weatherStatsRow(s.name, scope, today, start, stats(ts), now));
  }
  await insertRows(sql, 'paper_stats', STAT_COLS, rows, upsert(STAT_KEYS, STAT_COLS));
  return { events: recorded.length, trades: trades.length, strategies: strategies.length, warnings };
}

const TRADE_COLS = ['strategy', 'venue', 'city', 'date', 'bucket', 'side', 't', 'price', 'contracts', 'fee', 'pnl', 'won'] as const;
const STAT_COLS = [
  'domain',
  'strategy',
  'scope',
  'day',
  'since',
  'trades',
  'pnl',
  'roi',
  'total_return',
  'hold_return',
  'win_rate',
  'max_drawdown',
  'sharpe',
  'updated_at',
] as const;
const STAT_KEYS = ['domain', 'strategy', 'scope', 'day'];

const finite = (x: number | null | undefined): number | null => (x != null && Number.isFinite(x) ? x : null);

const weatherStatsRow = (strategy: string, scope: string, day: string, since: string, s: Stats, now: number): unknown[] => [
  'weather',
  strategy,
  scope,
  day,
  since,
  s.trades,
  finite(s.pnl),
  finite(s.roi),
  null,
  null,
  finite(s.winRate),
  finite(s.maxDrawdown),
  finite(s.sharpe),
  now,
];

async function paperCrypto(sql: Sql, start: string, now: number, log: (msg: string) => void): Promise<PaperReport['crypto']> {
  const end = isoDay(now);
  const skipped: { strategy: string; reason: string }[] = [];
  const rows: unknown[][] = [];
  for (const e of REGISTRY.values()) {
    const reason = skipReason(e, UNIVERSE);
    if (reason) {
      skipped.push({ strategy: e.id, reason });
      continue;
    }
    const interval = e.config.granularity ?? '1d';
    const assets = assetsFor(e, UNIVERSE);
    const seen = new Map<string, Map<string, number>>();
    const base = createFetchBars({ source: 'binance' });
    const fetchBars: FetchBars = async (req) => {
      const bars: DataBar[] = await base(req);
      seen.set(req.asset, new Map(bars.map((b) => [b.timestamp, b.close])));
      return bars;
    };
    try {
      const warmup = CRYPTO_WARMUP_DAYS[interval] ?? 30;
      const { result } = await runStrategy({
        strategy: e.id,
        assets,
        start: isoDay(Date.parse(start) - warmup * DAY),
        end,
        interval,
        capital: CAPITAL,
        fetchBars,
        costs: CRYPTO_COSTS,
      });
      const i = result.dates.findIndex((d) => d >= start);
      if (i < 0 || result.dates.length - i < 2) {
        skipped.push({ strategy: e.id, reason: 'no bars since start yet' });
        continue;
      }
      const from = result.dates[i]!;
      const sliced = {
        mode: result.mode,
        dates: result.dates.slice(i),
        nav: result.nav.slice(i),
        fills: result.fills.filter((f) => f.timestamp >= from),
        weights: { values: result.weights.values.slice(i) },
        transactionCosts: result.transactionCosts.slice(i),
      };
      const s = summarize(e.id, assets, interval, sliced, (a) => seen.get(a), result.warnings);
      rows.push([
        'crypto',
        e.id,
        'all',
        end,
        start,
        s.trades,
        finite(CAPITAL * s.totalReturn),
        null,
        finite(s.totalReturn),
        finite(s.holdReturn),
        null,
        finite(s.maxDrawdown),
        finite(s.sharpe),
        now,
      ]);
      log(`  crypto ${e.id} (${interval}): ${(s.totalReturn * 100).toFixed(2)}% vs hold ${(s.holdReturn * 100).toFixed(2)}%`);
    } catch (err) {
      skipped.push({ strategy: e.id, reason: `error: ${(err as Error).message}` });
    }
  }
  await insertRows(sql, 'paper_stats', STAT_COLS, rows, upsert(STAT_KEYS, STAT_COLS));
  return { strategies: rows.length, skipped };
}
