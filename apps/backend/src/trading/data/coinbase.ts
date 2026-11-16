import { getJson, intervalMs, type Row, sleep } from './interval';

const BASE = 'https://api.exchange.coinbase.com/products';
const MAX_BUCKETS = 300;
const GRANULARITIES = new Set([60, 300, 900, 3600, 21600, 86400]);
const MIN_GAP_MS = 150;

let lastCall = 0;
async function throttle(): Promise<void> {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

export async function fetchCoinbase(
  asset: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Row[]> {
  const step = intervalMs(interval);
  const g = step / 1000;
  if (g === 1800) return aggregate(await fetchCoinbase(asset, '15m', startMs, endMs), step);
  if (!GRANULARITIES.has(g))
    throw new Error(`Coinbase has no ${interval} candles (60s, 5m, 15m, 1h, 6h, 1d; 30m is built from 15m)`);

  const product = asset.toUpperCase();
  const now = Date.now();
  const byTime = new Map<number, Row>();
  for (let cursor = startMs; cursor < endMs; cursor += MAX_BUCKETS * step) {
    const last = Math.min(cursor + (MAX_BUCKETS - 1) * step, endMs - step);
    if (last < cursor) break;
    await throttle();
    const url = `${BASE}/${product}/candles?granularity=${g}&start=${new Date(cursor).toISOString()}&end=${new Date(last).toISOString()}`;
    const rows = await getJson<[number, number, number, number, number, number][]>(url);
    for (const [t, low, high, open, close, volume] of rows) {
      const ms = t * 1000;
      if (ms < startMs || ms >= endMs || ms + step > now) continue;
      byTime.set(ms, [ms, open, high, low, close, volume]);
    }
  }
  return [...byTime.values()].sort((a, b) => a[0] - b[0]);
}

export function aggregate(rows: readonly Row[], step: number): Row[] {
  const out: Row[] = [];
  for (const r of rows) {
    const bucket = Math.floor(r[0] / step) * step;
    const cur = out[out.length - 1];
    if (cur && cur[0] === bucket) {
      cur[2] = Math.max(cur[2], r[2]);
      cur[3] = Math.min(cur[3], r[3]);
      cur[4] = r[4];
      cur[5] += r[5];
    } else out.push([bucket, r[1], r[2], r[3], r[4], r[5]]);
  }
  return out;
}
