import type { Venue } from '../trading/weather/cities';
import type { Bucket, MarketEvent, Quote } from '../trading/weather/types';

export interface BucketRow {
  id: string;
  label: string;
  lo: number | null;
  hi: number | null;
}

export const bucketRow = (id: string, label: string, lo: number, hi: number): BucketRow => ({
  id,
  label,
  lo: Number.isFinite(lo) ? lo : null,
  hi: Number.isFinite(hi) ? hi : null,
});

export type BookTop = [number | null, number | null, number | null, number | null];

export interface EventRow {
  venue: Venue;
  event_id: string;
  city: string;
  date: string;
  close_ms: number;
  fee: number;
  buckets: string;
  results: string | null;
  settled_high: number | null;
}

export interface SnapshotRow {
  event_id: string;
  t: number;
  quotes: string;
}

export function toMarketEvent(e: EventRow, snapshots: readonly SnapshotRow[]): MarketEvent | null {
  if (!e.results) return null;
  const results = JSON.parse(e.results) as Record<string, 0 | 1>;
  const quotes = new Map<string, Quote[]>();
  for (const s of [...snapshots].sort((a, b) => a.t - b.t)) {
    for (const [id, [bid, ask]] of Object.entries(JSON.parse(s.quotes) as Record<string, BookTop>)) {
      const list = quotes.get(id) ?? [];
      list.push({ t: s.t, bid: bid != null && bid > 0 ? bid : null, ask: ask != null && ask < 1 ? ask : null });
      quotes.set(id, list);
    }
  }
  const buckets: Bucket[] = [];
  for (const b of JSON.parse(e.buckets) as BucketRow[]) {
    const result = results[b.id];
    if (result == null) return null;
    buckets.push({
      id: b.id,
      label: b.label,
      lo: b.lo ?? -Infinity,
      hi: b.hi ?? Infinity,
      result,
      quotes: quotes.get(b.id) ?? [],
    });
  }
  if (buckets.length < 2 || buckets.filter((b) => b.result === 1).length !== 1) return null;
  return {
    venue: e.venue,
    cityId: e.city,
    date: e.date,
    closeMs: e.close_ms,
    buckets: buckets.sort((a, b) => a.lo - b.lo),
    fee: { venue: e.venue, rate: e.fee },
    settledHigh: e.settled_high,
  };
}

export function metarTempC(raw: string, temp: number | null | undefined): number | null {
  const m = /\bT([01])(\d{3})(?:[01]\d{3})?\b/.exec(raw);
  if (m) return ((m[1] === '1' ? -1 : 1) * Number(m[2])) / 10;
  return temp ?? null;
}
