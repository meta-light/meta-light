import { insertRows, type Sql, upsert } from '../database/sql';
import { fetchBinance } from '../trading/data/binance';
import { fetchCoinbase } from '../trading/data/coinbase';
import { coingeckoId } from '../trading/data/coingecko';
import { getJson, type Row } from '../trading/data/interval';
import { CITIES } from '../trading/weather/cities';
import {
  eventDate,
  type GammaEvent,
  type KalshiMarket,
  parseList,
  parseTitle,
  SERIES_IDS,
  strikeRange,
} from '../trading/weather/markets';
import { type BookTop, bucketRow, type BucketRow, metarTempC } from './records';

export const CRYPTO_ASSETS = ['BTC-USD', 'ETH-USD', 'SOL-USD'] as const;
export const FORECAST_MODELS = ['gfs_seamless', 'ecmwf_ifs025', 'icon_seamless', 'gem_seamless'] as const;

const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2';
const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type Job = (sql: Sql, now: number) => Promise<number>;

const BAR_COLS = ['source', 'symbol', 'interval', 'open_time', 'open', 'high', 'low', 'close', 'volume'] as const;
const BAR_KEYS = ['source', 'symbol', 'interval', 'open_time'];

const saveBars = (sql: Sql, source: string, interval: string, bars: [string, Row][]): Promise<number> =>
  insertRows(
    sql,
    'crypto_bars',
    BAR_COLS,
    bars.map(([symbol, r]) => [source, symbol, interval, ...r]),
    upsert(BAR_KEYS, BAR_COLS),
  );

const recentBars =
  (source: 'binance' | 'coinbase', fetch: typeof fetchBinance): Job =>
  async (sql, now) => {
    const end = now - (now % (5 * MIN));
    const bars: [string, Row][] = [];
    for (const a of CRYPTO_ASSETS) for (const r of await fetch(a, '5m', end - HOUR, end)) bars.push([a, r]);
    return saveBars(sql, source, '5m', bars);
  };

const coingeckoSpot: Job = async (sql, now) => {
  const ids = CRYPTO_ASSETS.map(coingeckoId);
  const res = await getJson<Record<string, { usd?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
  );
  const t = now - (now % MIN);
  const bars: [string, Row][] = [];
  CRYPTO_ASSETS.forEach((a, i) => {
    const p = res[ids[i]!]?.usd;
    if (p != null) bars.push([a, [t, p, p, p, p, 0]]);
  });
  return saveBars(sql, 'coingecko', 'spot', bars);
};

const EVENT_COLS = ['venue', 'event_id', 'city', 'date', 'close_ms', 'fee', 'buckets', 'updated_at'] as const;
const EVENT_UPSERT = upsert(['venue', 'event_id'], EVENT_COLS);
const SNAP_COLS = ['venue', 'event_id', 't', 'quotes'] as const;
const SNAP_UPSERT = upsert(['venue', 'event_id', 't'], SNAP_COLS);

interface OpenEvent {
  id: string;
  city: string;
  date: string;
  closeMs: number;
  fee: number;
  buckets: BucketRow[];
  quotes: Record<string, BookTop>;
}

async function saveOpen(sql: Sql, venue: 'kalshi' | 'polymarket', now: number, events: OpenEvent[]): Promise<number> {
  await insertRows(
    sql,
    'weather_events',
    EVENT_COLS,
    events.map((e) => [venue, e.id, e.city, e.date, e.closeMs, e.fee, JSON.stringify(e.buckets), now]),
    EVENT_UPSERT,
  );
  const t = now - (now % MIN);
  return insertRows(
    sql,
    'weather_snapshots',
    SNAP_COLS,
    events.map((e) => [venue, e.id, t, JSON.stringify(e.quotes)]),
    SNAP_UPSERT,
  );
}

type KalshiLive = KalshiMarket & {
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  yes_bid_size_fp?: string;
  yes_ask_size_fp?: string;
};

const num = (s: string | number | null | undefined): number | null => {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const kalshiBooks: Job = async (sql, now) => {
  const events: OpenEvent[] = [];
  for (const city of CITIES) {
    const res = await getJson<{ events: { event_ticker: string; markets?: KalshiLive[] }[] }>(
      `${KALSHI}/events?series_ticker=${city.kalshi.series}&status=open&with_nested_markets=true`,
    );
    for (const ev of res.events) {
      const date = eventDate(ev.event_ticker);
      const markets = (ev.markets ?? []).filter((m) => strikeRange(m));
      if (!date || markets.length < 2) continue;
      const buckets = markets
        .map((m) => {
          const [lo, hi] = strikeRange(m)!;
          return bucketRow(m.ticker, m.yes_sub_title ?? m.ticker, lo, hi);
        })
        .sort((a, b) => (a.lo ?? -Infinity) - (b.lo ?? -Infinity));
      const quotes: Record<string, BookTop> = {};
      for (const m of markets) {
        quotes[m.ticker] = [num(m.yes_bid_dollars), num(m.yes_ask_dollars), num(m.yes_bid_size_fp), num(m.yes_ask_size_fp)];
      }
      events.push({
        id: ev.event_ticker,
        city: city.id,
        date,
        closeMs: Math.max(...markets.map((m) => Date.parse(m.close_time))),
        fee: 0.07,
        buckets,
        quotes,
      });
    }
  }
  return saveOpen(sql, 'kalshi', now, events);
};

interface ClobBook {
  asset_id: string;
  bids?: { price: string; size: string }[];
  asks?: { price: string; size: string }[];
}

type GammaLive = GammaEvent & { closed?: boolean };

const polymarketBooks: Job = async (sql, now) => {
  const events: OpenEvent[] = [];
  for (const city of CITIES) {
    const id = SERIES_IDS[city.polymarket.series];
    if (id == null) continue;
    const open = await getJson<GammaLive[]>(`${GAMMA}/events?series_id=${id}&closed=false&limit=20`);
    const parsed = open.flatMap((ev) => {
      const rows = ev.markets.map((m) => {
        const range = m.groupItemTitle ? parseTitle(m.groupItemTitle) : null;
        const token = parseList(m.clobTokenIds)[0];
        const fee = m.feesEnabled ? (m.feeSchedule?.rate ?? 0) : 0;
        return range && token ? { range, token, title: m.groupItemTitle!, fee } : null;
      });
      if (rows.length < 2 || rows.some((r) => !r)) return [];
      return [{ ev, rows: rows as NonNullable<(typeof rows)[number]>[] }];
    });
    const tokens = parsed.flatMap((p) => p.rows.map((r) => r.token));
    if (!tokens.length) continue;
    const books = await postJson<ClobBook[]>(`${CLOB}/books`, tokens.map((token_id) => ({ token_id })));
    const byToken = new Map(books.map((b) => [b.asset_id, b]));
    for (const { ev, rows } of parsed) {
      const quotes: Record<string, BookTop> = {};
      for (const r of rows) {
        const b = byToken.get(r.token);
        const bid = b?.bids?.at(-1);
        const ask = b?.asks?.at(-1);
        quotes[r.token] = [num(bid?.price), num(ask?.price), num(bid?.size), num(ask?.size)];
      }
      events.push({
        id: ev.slug,
        city: city.id,
        date: ev.endDate.slice(0, 10),
        closeMs: Date.parse(ev.endDate) + DAY,
        fee: Math.max(...rows.map((r) => r.fee)),
        buckets: rows.map((r) => bucketRow(r.token, r.title, r.range[0], r.range[1])).sort((a, b) => (a.lo ?? -Infinity) - (b.lo ?? -Infinity)),
        quotes,
      });
    }
  }
  return saveOpen(sql, 'polymarket', now, events);
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

const STATIONS = [...new Map(CITIES.flatMap((c) => [c.kalshi.station, c.polymarket.station]).map((s) => [s.icao, s])).values()];

const metars: Job = async (sql) => {
  const res = await getJson<{ icaoId: string; obsTime: number; temp?: number | null; rawOb: string }[]>(
    `https://aviationweather.gov/api/data/metar?ids=${STATIONS.map((s) => s.icao).join(',')}&format=json&hours=2`,
  );
  return insertRows(
    sql,
    'weather_obs',
    ['station', 't', 'temp_c', 'raw'],
    res.map((o) => [o.icaoId, o.obsTime * 1000, metarTempC(o.rawOb, o.temp), o.rawOb]),
    'ON CONFLICT (station, t) DO NOTHING',
  );
};

const forecasts: Job = async (sql, now) => {
  const t = now - (now % HOUR);
  const rows: unknown[][] = [];
  for (const s of STATIONS) {
    const res = await getJson<{ hourly: Record<string, unknown> }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=temperature_2m` +
        `&models=${FORECAST_MODELS.join(',')}&temperature_unit=fahrenheit&timezone=GMT&forecast_days=4`,
    );
    rows.push([s.icao, t, JSON.stringify(res.hourly)]);
  }
  return insertRows(sql, 'weather_forecasts', ['station', 't', 'hourly'], rows, 'ON CONFLICT (station, t) DO NOTHING');
};

interface Unsettled {
  venue: 'kalshi' | 'polymarket';
  event_id: string;
}

const settle: Job = async (sql, now) => {
  const today = new Date(now).toISOString().slice(0, 10);
  const oldest = new Date(now - 10 * DAY).toISOString().slice(0, 10);
  const pending = await sql.all<Unsettled>(
    'SELECT venue, event_id FROM weather_events WHERE results IS NULL AND date < ? AND date >= ? LIMIT 100',
    [today, oldest],
  );
  let n = 0;
  for (const p of pending) {
    const done = p.venue === 'kalshi' ? await settleKalshi(p.event_id) : await settlePolymarket(p.event_id);
    if (!done) continue;
    await sql.run(
      'UPDATE weather_events SET results = ?, settled_high = ?, close_ms = COALESCE(?, close_ms), updated_at = ? WHERE venue = ? AND event_id = ?',
      [JSON.stringify(done.results), done.high, done.closeMs, now, p.venue, p.event_id],
    );
    n++;
  }
  return n;
};

interface Settled {
  results: Record<string, 0 | 1>;
  high: number | null;
  closeMs: number | null;
}

const oneWinner = (r: Record<string, 0 | 1>): boolean => Object.values(r).filter((x) => x === 1).length === 1;

async function settleKalshi(eventTicker: string): Promise<Settled | null> {
  const res = await getJson<{ event?: { markets?: KalshiMarket[] }; markets?: KalshiMarket[] }>(
    `${KALSHI}/events/${eventTicker}?with_nested_markets=true`,
  );
  const markets = res.event?.markets ?? res.markets ?? [];
  if (!markets.length || markets.some((m) => m.result !== 'yes' && m.result !== 'no')) return null;
  const results = Object.fromEntries(markets.map((m) => [m.ticker, m.result === 'yes' ? 1 : 0])) as Record<string, 0 | 1>;
  if (!oneWinner(results)) return null;
  const high = markets.find((m) => m.expiration_value)?.expiration_value;
  return { results, high: high ? Number(high) : null, closeMs: null };
}

async function settlePolymarket(slug: string): Promise<Settled | null> {
  const [ev] = await getJson<GammaEvent[]>(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`);
  if (!ev) return null;
  const results: Record<string, 0 | 1> = {};
  for (const m of ev.markets) {
    const token = parseList(m.clobTokenIds)[0];
    const prices = parseList(m.outcomePrices).map(Number);
    if (!token) continue;
    if (prices[0] === 1 && prices[1] === 0) results[token] = 1;
    else if (prices[0] === 0 && prices[1] === 1) results[token] = 0;
    else return null;
  }
  if (!oneWinner(results)) return null;
  const closed = ev.closedTime ? Date.parse(ev.closedTime.replace(' ', 'T').replace(/\+00$/, 'Z')) : NaN;
  return { results, high: null, closeMs: Number.isFinite(closed) ? closed : null };
}

export const FAST_JOBS: Record<string, Job> = {
  'crypto:binance': recentBars('binance', fetchBinance),
  'crypto:coinbase': recentBars('coinbase', fetchCoinbase),
  'crypto:coingecko': coingeckoSpot,
  'weather:kalshi': kalshiBooks,
  'weather:polymarket': polymarketBooks,
  'weather:metar': metars,
};

export const HOURLY_JOBS: Record<string, Job> = {
  'weather:forecasts': forecasts,
  'weather:settle': settle,
};

export interface JobResult {
  job: string;
  ok: boolean;
  rows: number;
  ms: number;
  error?: string;
}

export async function runJobs(sql: Sql, jobs: Record<string, Job>, now = Date.now()): Promise<JobResult[]> {
  const results = await Promise.all(
    Object.entries(jobs).map(async ([job, run]): Promise<JobResult> => {
      const start = Date.now();
      try {
        return { job, ok: true, rows: await run(sql, now), ms: Date.now() - start };
      } catch (e) {
        return { job, ok: false, rows: 0, ms: Date.now() - start, error: String(e instanceof Error ? e.message : e).slice(0, 1000) };
      }
    }),
  );
  await insertRows(
    sql,
    'collector_runs',
    ['job', 't', 'ok', 'rows', 'ms', 'error'],
    results.map((r) => [r.job, now, r.ok ? 1 : 0, r.rows, r.ms, r.error ?? null]),
    'ON CONFLICT (job, t) DO NOTHING',
  );
  return results;
}
