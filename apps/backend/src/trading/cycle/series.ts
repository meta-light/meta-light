import { coinmetricsDaily } from '../data/coinmetrics';
import { getJson } from '../data/interval';
import { getStore, type KvStore } from '../store';
import type { SeriesPoint } from '../strategies/engine/index';

export type SeriesName = 'mvrv' | 'fear_greed' | 'm2' | 'miner_revenue';

const MAX_AGE_MS = 12 * 3_600_000;
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

async function mvrv(): Promise<SeriesPoint[]> {
  return (await coinmetricsDaily('btc', 'CapMVRVCur')).map(([t, v]) => [day(t), v]);
}

// alternative.me stamps each value at 00:00 UTC of the day it is published.
async function fearGreed(): Promise<SeriesPoint[]> {
  const res = await getJson<{ data: { value: string; timestamp: string }[] }>(
    'https://api.alternative.me/fng/?limit=0&format=json',
  );
  return res.data.map((r) => [day(Number(r.timestamp) * 1000), Number(r.value)]);
}

// H.6 publishes month M around the 4th Tuesday of M+1, so it is first usable on day 1 of M+2.
export function m2FromCsv(csv: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const line of csv.trim().split('\n').slice(1)) {
    const [date, raw] = line.split(',');
    const v = Number(raw);
    if (!date || !Number.isFinite(v)) continue;
    const [y, m] = date.split('-').map(Number) as [number, number];
    out.push([day(Date.UTC(y, m + 1, 1)), v]);
  }
  return out;
}

// FRED silently drops connections that claim a Mozilla user agent, so this keeps Bun's default one.
async function m2(): Promise<SeriesPoint[]> {
  const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL', {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`FRED M2SL -> ${res.status}`);
  return m2FromCsv(await res.text());
}

async function minerRevenue(): Promise<SeriesPoint[]> {
  const res = await getJson<{ values: { x: number; y: number }[] }>(
    'https://api.blockchain.info/charts/miners-revenue?timespan=all&format=json&sampled=false',
  );
  return res.values.filter((p) => p.y > 0).map((p) => [day(p.x * 1000), p.y]);
}

const FETCHERS: Record<SeriesName, () => Promise<SeriesPoint[]>> = {
  mvrv,
  fear_greed: fearGreed,
  m2,
  miner_revenue: minerRevenue,
};

export const SERIES = Object.keys(FETCHERS) as SeriesName[];

export type FetchSeries = (name: string) => Promise<SeriesPoint[]>;

export function createFetchSeries(
  store: KvStore = getStore(),
  now: () => number = Date.now,
  fetchers: Record<string, () => Promise<SeriesPoint[]>> = FETCHERS,
): FetchSeries {
  return async (name) => {
    const fetcher = fetchers[name];
    if (!fetcher) throw new Error(`Unknown series "${name}" (have ${Object.keys(fetchers).join(', ')})`);
    const key = `series/${name}`;
    const hit = await store.get(key);
    const cached = hit ? (JSON.parse(hit) as { fetchedAt: number; points: SeriesPoint[] }) : null;
    if (cached && now() - cached.fetchedAt < MAX_AGE_MS) return cached.points;
    try {
      const points = await fetcher();
      if (!points.length) throw new Error(`series ${name} came back empty`);
      await store.put(key, JSON.stringify({ fetchedAt: now(), points }));
      return points;
    } catch (err) {
      if (cached) return cached.points;
      throw err;
    }
  };
}
