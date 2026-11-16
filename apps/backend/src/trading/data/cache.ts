import { diskStore, getStore, type KvStore } from '../store';
import { intervalMs, type Row } from './interval';

export { DEFAULT_CACHE_DIR } from '../store';

export type RangeFetcher = (
  asset: string,
  interval: string,
  startMs: number,
  endMs: number,
) => Promise<Row[]>;

export function monthsBetween(startMs: number, endMs: number): number[] {
  const months: number[] = [];
  const d = new Date(startMs);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  while (t < endMs) {
    months.push(t);
    const m = new Date(t);
    t = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
  }
  return months;
}

const nextMonth = (t: number): number => {
  const m = new Date(t);
  return Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
};

export function withMonthCache(
  source: string,
  fetchRange: RangeFetcher,
  cache?: string | KvStore,
  now: () => number = Date.now,
): RangeFetcher {
  return async (asset, interval, startMs, endMs) => {
    const store = typeof cache === 'string' ? diskStore(cache) : (cache ?? getStore());
    const step = intervalMs(interval);
    const rows: Row[] = [];
    for (const month of monthsBetween(startMs, endMs)) {
      const end = nextMonth(month);
      const key = `bars/${source}/${asset.toUpperCase()}/${interval}/${new Date(month).toISOString().slice(0, 7)}`;
      const hit = await store.get(key);
      let monthRows = hit ? (JSON.parse(hit) as Row[]) : null;
      if (!monthRows) {
        monthRows = await fetchRange(asset, interval, month, Math.min(end, now()));
        const closed = end + step <= now();
        if (closed && monthRows.length) await store.put(key, JSON.stringify(monthRows));
      }
      for (const r of monthRows) if (r[0] >= startMs && r[0] < endMs) rows.push(r);
    }
    return rows;
  };
}
