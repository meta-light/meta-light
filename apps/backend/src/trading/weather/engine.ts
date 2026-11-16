import type { Venue } from './cities';
import { bucketProbs, decisionMs, predictor, residuals, type CityData, type Lead, type ModelParams } from './model';
import type { Bucket, FeeModel, MarketEvent, Quote } from './types';

export type Side = 'yes' | 'no';

export interface FillParams {
  stake: number;
  maxStaleMs: number;
  halfSpread: number;
}

export const DEFAULT_FILL: FillParams = { stake: 10, maxStaleMs: 6 * 3_600_000, halfSpread: 0.01 };

export const kalshiFee = (contracts: number, price: number): number =>
  Math.ceil(0.07 * contracts * price * (1 - price) * 100 - 1e-9) / 100;

export const polymarketFee = (contracts: number, price: number, rate: number): number =>
  contracts * rate * price * (1 - price);

export function fee(model: FeeModel, contracts: number, price: number): number {
  return model.venue === 'kalshi' ? kalshiFee(contracts, price) : polymarketFee(contracts, price, model.rate);
}

export function quoteAt(quotes: readonly Quote[], t: number, maxStaleMs: number): Quote | null {
  let lo = 0;
  let hi = quotes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (quotes[mid]!.t <= t) lo = mid + 1;
    else hi = mid;
  }
  const q = quotes[lo - 1];
  return q && t - q.t <= maxStaleMs ? q : null;
}

export function buyPrice(q: Quote | null, side: Side, venue: Venue, halfSpread: number): number | null {
  if (!q) return null;
  const hs = venue === 'polymarket' ? halfSpread : 0;
  const p = side === 'yes' ? (q.ask == null ? null : q.ask + hs) : q.bid == null ? null : 1 - (q.bid - hs);
  if (p == null || p <= 0.01 || p >= 0.99) return null;
  return Math.round(p * 1000) / 1000;
}

export function midAt(quotes: readonly Quote[], t: number, maxStaleMs: number): number | null {
  const q = quoteAt(quotes, t, maxStaleMs);
  if (!q || (q.bid == null && q.ask == null)) return null;
  return ((q.bid ?? 0) + (q.ask ?? 1)) / 2;
}

export interface Order {
  bucket: Bucket;
  side: Side;
  t: number;
  edge?: number;
}

export interface Trade {
  strategy: string;
  venue: Venue;
  cityId: string;
  date: string;
  bucket: string;
  side: Side;
  t: number;
  price: number;
  contracts: number;
  fee: number;
  pnl: number;
  won: boolean;
  edge?: number;
}

export function fill(strategy: string, ev: MarketEvent, o: Order, p: FillParams): Trade | null {
  const price = buyPrice(quoteAt(o.bucket.quotes, o.t, p.maxStaleMs), o.side, ev.venue, p.halfSpread);
  if (price == null || o.t >= ev.closeMs) return null;
  const contracts = ev.venue === 'kalshi' ? Math.max(1, Math.floor(p.stake / price)) : p.stake / price;
  const f = fee(ev.fee, contracts, price);
  const won = (o.side === 'yes') === (o.bucket.result === 1);
  const pnl = (won ? contracts : 0) - contracts * price - f;
  return {
    strategy,
    venue: ev.venue,
    cityId: ev.cityId,
    date: ev.date,
    bucket: o.bucket.label,
    side: o.side,
    t: o.t,
    price,
    contracts: Math.round(contracts * 100) / 100,
    fee: Math.round(f * 10000) / 10000,
    pnl: Math.round(pnl * 10000) / 10000,
    won,
    ...(o.edge == null ? {} : { edge: Math.round(o.edge * 1000) / 1000 }),
  };
}

export class EventView {
  private probsMemo = new Map<Lead, number[] | null>();
  constructor(
    readonly event: MarketEvent,
    readonly data: CityData,
    readonly model: ModelParams,
    readonly fills: FillParams,
    private readonly residualMemo: Map<string, number | null>,
  ) {}

  decision(lead: Lead): number {
    return decisionMs(this.data.city, this.event.date, lead);
  }

  probs(lead: Lead): number[] | null {
    if (!this.probsMemo.has(lead)) {
      const pred = predictor(this.data, this.event.date, lead);
      const res = pred ? residuals(this.data, this.event.date, lead, this.model, this.residualMemo) : [];
      this.probsMemo.set(
        lead,
        pred && res.length >= this.model.minResiduals ? bucketProbs(this.event.buckets, pred, res, this.model.bandwidth) : null,
      );
    }
    return this.probsMemo.get(lead)!;
  }

  price(b: Bucket, side: Side, t: number): number | null {
    return buyPrice(quoteAt(b.quotes, t, this.fills.maxStaleMs), side, this.event.venue, this.fills.halfSpread);
  }

  mid(b: Bucket, t: number): number | null {
    return midAt(b.quotes, t, this.fills.maxStaleMs);
  }

  feePer(price: number): number {
    const c = this.event.venue === 'kalshi' ? Math.max(1, Math.floor(this.fills.stake / price)) : this.fills.stake / price;
    return fee(this.event.fee, c, price) / c;
  }
}

export interface Strategy {
  name: string;
  decide(view: EventView): Order[];
}

export interface Stats {
  trades: number;
  winRate: number;
  staked: number;
  pnl: number;
  roi: number;
  maxDrawdown: number;
  sharpe: number;
  days: number;
}

export function stats(trades: readonly Trade[]): Stats {
  const staked = trades.reduce((a, t) => a + t.contracts * t.price, 0);
  const pnl = trades.reduce((a, t) => a + t.pnl, 0);
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.pnl);
  const daily = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  let cum = 0;
  let peak = 0;
  let dd = 0;
  for (const v of daily) {
    cum += v;
    peak = Math.max(peak, cum);
    dd = Math.max(dd, peak - cum);
  }
  const mean = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
  const sd = daily.length > 1 ? Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / (daily.length - 1)) : 0;
  const r = (x: number, k = 2) => Math.round(x * 10 ** k) / 10 ** k;
  return {
    trades: trades.length,
    winRate: r(trades.length ? trades.filter((t) => t.won).length / trades.length : 0, 3),
    staked: r(staked),
    pnl: r(pnl),
    roi: r(staked ? pnl / staked : 0, 4),
    maxDrawdown: r(dd),
    sharpe: r(sd > 0 ? (mean / sd) * Math.sqrt(365) : 0),
    days: daily.length,
  };
}

export interface BrierRow {
  venue: Venue;
  cityId: string;
  lead: Lead;
  events: number;
  model: number;
  market: number;
}

export function brier(views: readonly EventView[], lead: Lead): Omit<BrierRow, 'venue' | 'cityId'> {
  let model = 0;
  let market = 0;
  let n = 0;
  for (const v of views) {
    const probs = v.probs(lead);
    if (!probs) continue;
    const t = v.decision(lead);
    const mids = v.event.buckets.map((b) => v.mid(b, t));
    if (mids.some((m) => m == null)) continue;
    const sum = mids.reduce<number>((a, m) => a + m!, 0);
    if (sum <= 0) continue;
    v.event.buckets.forEach((b, i) => {
      model += (probs[i]! - b.result) ** 2;
      market += (mids[i]! / sum - b.result) ** 2;
    });
    n++;
  }
  const r = (x: number) => Math.round(x * 10000) / 10000;
  return { lead, events: n, model: n ? r(model / n) : 0, market: n ? r(market / n) : 0 };
}
