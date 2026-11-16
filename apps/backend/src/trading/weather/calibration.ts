import type { Venue } from './cities';
import type { EventView } from './engine';
import type { Lead } from './model';
import { addDays } from './time';

export const BIN_EDGES = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 1] as const;

export const binOf = (mid: number): number => {
  const i = BIN_EDGES.findIndex((e) => mid < e);
  return i < 0 ? BIN_EDGES.length - 1 : i;
};

export const binLabel = (i: number): string => `${i ? BIN_EDGES[i - 1] : 0}-${BIN_EDGES[i]}`;

export interface CalRow {
  venue: Venue;
  lead: Lead;
  bin: string;
  n: number;
  mid: number;
  freq: number;
  yesRoi: number | null;
  noRoi: number | null;
}

interface Acc {
  n: number;
  mid: number;
  wins: number;
  yes: [number, number];
  no: [number, number];
}

export function calibration(views: readonly EventView[], lead: Lead, filter: (v: EventView) => boolean = () => true): CalRow[] {
  const acc: Acc[] = BIN_EDGES.map(() => ({ n: 0, mid: 0, wins: 0, yes: [0, 0], no: [0, 0] }));
  let venue: Venue = 'kalshi';
  for (const v of views) {
    if (!filter(v)) continue;
    venue = v.event.venue;
    const t = v.decision(lead);
    if (t >= v.event.closeMs) continue;
    for (const b of v.event.buckets) {
      const m = v.mid(b, t);
      if (m == null) continue;
      const a = acc[binOf(m)]!;
      a.n++;
      a.mid += m;
      a.wins += b.result;
      for (const side of ['yes', 'no'] as const) {
        const p = v.price(b, side, t);
        if (p == null) continue;
        const won = side === 'yes' ? b.result : 1 - b.result;
        const r = (won - p - v.feePer(p)) / p;
        a[side][0] += r;
        a[side][1]++;
      }
    }
  }
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return acc.flatMap((a, i) =>
    a.n
      ? [{
          venue,
          lead,
          bin: binLabel(i),
          n: a.n,
          mid: r(a.mid / a.n),
          freq: r(a.wins / a.n),
          yesRoi: a.yes[1] ? r(a.yes[0] / a.yes[1]) : null,
          noRoi: a.no[1] ? r(a.no[0] / a.no[1]) : null,
        }]
      : [],
  );
}

export class Calibrator {
  private byKey = new Map<string, Map<string, { n: number; mid: number; wins: number }[]>>();

  constructor(
    readonly prior = 20,
    readonly minN = 50,
    readonly settleDays = 2,
  ) {}

  private bins(venue: Venue, lead: Lead, date: string) {
    const key = `${venue}|${lead}`;
    let byDate = this.byKey.get(key);
    if (!byDate) this.byKey.set(key, (byDate = new Map()));
    let bins = byDate.get(date);
    if (!bins) byDate.set(date, (bins = BIN_EDGES.map(() => ({ n: 0, mid: 0, wins: 0 }))));
    return bins;
  }

  observe(venue: Venue, lead: Lead, date: string, mid: number, result: 0 | 1): void {
    const b = this.bins(venue, lead, date)[binOf(mid)]!;
    b.n++;
    b.mid += mid;
    b.wins += result;
  }

  prob(venue: Venue, lead: Lead, date: string, mid: number): number | null {
    const byDate = this.byKey.get(`${venue}|${lead}`);
    if (!byDate) return null;
    const cutoff = addDays(date, -this.settleDays);
    const i = binOf(mid);
    let n = 0;
    let wins = 0;
    let sumMid = 0;
    for (const [d, bins] of byDate) {
      if (d > cutoff) continue;
      n += bins[i]!.n;
      wins += bins[i]!.wins;
      sumMid += bins[i]!.mid;
    }
    if (n < this.minN) return null;
    return (wins + this.prior * (sumMid / n)) / (n + this.prior);
  }
}
