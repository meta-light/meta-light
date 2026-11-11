// Ported from backtester/portfolio/instr_data.py and the indicator step in
// backtester/core.py (QuantJourney Backtester, Apache 2.0).
//
// BarData turns per-instrument OHLC bars into the date x instrument frames a
// strategy reads through getFeature(). The SMA, EMA and RSI kernels below match
// quantjourney_ti (_indicator_kernels.py), so feature values match what the
// Python engine fed the original strategies, NaN handling included.
//
// About NaN: those kernels are compiled with numba fastmath, which drops their
// isnan checks. The SMA window check still works, but EMA and RSI go NaN from
// the first missing price onward (all NaN if it falls in the seed window).
// We reproduce that on purpose by running them on the prefix before the
// first NaN.

import { type Bar, Frame, type IndicatorSpec, type InstrumentData } from "../core";
import { toMs } from "./metrics/series";

/** A bar with an optional split/dividend-adjusted close. */
export type DataBar = Bar & { adjClose?: number };

export type BarFetcher = (instrument: string) => Promise<DataBar[]>;

const PRICE_FIELDS = ["open", "high", "low", "close", "volume", "adj_close"] as const;
type PriceField = (typeof PRICE_FIELDS)[number];

// --- quantjourney_ti kernels -----------------------------------------------

/** Run `kernel` on the prices before the first NaN and pad the rest with NaN. */
function untilFirstNaN(prices: readonly number[], kernel: (p: readonly number[]) => number[]): number[] {
  const cut = prices.findIndex((v) => Number.isNaN(v));
  if (cut < 0) return kernel(prices);
  const head = cut >= 1 ? kernel(prices.slice(0, cut)) : [];
  // A window longer than the prefix still yields NaN, as the full-length guard would.
  return [...head, ...new Array<number>(prices.length - head.length).fill(NaN)];
}

/** Simple moving average. NaN wherever the window holds a NaN. */
export function sma(prices: readonly number[], window: number): number[] {
  const n = prices.length;
  const out = new Array<number>(n).fill(NaN);
  if (n === 0 || window <= 0 || window > n) return out;
  for (let i = window - 1; i < n; i++) {
    let total = 0;
    let hasNaN = false;
    for (let j = i - window + 1; j <= i; j++) {
      if (Number.isNaN(prices[j]!)) {
        hasNaN = true;
        break;
      }
      total += prices[j]!;
    }
    if (!hasNaN) out[i] = total / window;
  }
  return out;
}

/** Exponential moving average seeded with the mean of the first window. */
export function ema(prices: readonly number[], window: number): number[] {
  return untilFirstNaN(prices, (p) => emaKernel(p, window));
}

function emaKernel(prices: readonly number[], window: number): number[] {
  const n = prices.length;
  const out = new Array<number>(n).fill(NaN);
  if (n === 0 || window <= 0 || window > n) return out;
  const mult = 2 / (window + 1);
  let total = 0;
  for (let i = 0; i < window; i++) total += prices[i]!;
  out[window - 1] = total / window;
  for (let i = window; i < n; i++) out[i] = (prices[i]! - out[i - 1]!) * mult + out[i - 1]!;
  return out;
}

/** Wilder RSI. */
export function rsi(prices: readonly number[], period: number): number[] {
  return untilFirstNaN(prices, (p) => rsiKernel(p, period));
}

function rsiKernel(prices: readonly number[], period: number): number[] {
  const n = prices.length;
  const out = new Array<number>(n).fill(NaN);
  if (n === 0 || period <= 0 || period > n) return out;
  const gains = new Array<number>(n).fill(0);
  const losses = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change > 0) gains[i] = change;
    else if (change < 0) losses[i] = -change;
  }
  const avgGain = new Array<number>(n).fill(NaN);
  const avgLoss = new Array<number>(n).fill(NaN);
  if (period < n) {
    let g = 0;
    let l = 0;
    for (let i = 1; i <= period; i++) {
      g += gains[i]!;
      l += losses[i]!;
    }
    avgGain[period] = g / period;
    avgLoss[period] = l / period;
    for (let i = period + 1; i < n; i++) {
      avgGain[i] = (avgGain[i - 1]! * (period - 1) + gains[i]!) / period;
      avgLoss[i] = (avgLoss[i - 1]! * (period - 1) + losses[i]!) / period;
    }
  }
  for (let i = period; i < n; i++) {
    const g = avgGain[i]!;
    const l = avgLoss[i]!;
    if (Number.isNaN(g) || Number.isNaN(l)) continue;
    if (g === 0 && l === 0) out[i] = 50;
    else if (l === 0) out[i] = 100;
    else out[i] = 100 - 100 / (1 + g / l);
  }
  return out;
}

const KERNELS: Record<IndicatorSpec["function"], (prices: readonly number[], period: number) => number[]> = {
  SMA: sma,
  EMA: ema,
  RSI: rsi,
};

// --- BarData ---------------------------------------------------------------

/**
 * Instrument data built from OHLC bars. Dates are the sorted union across
 * instruments; an instrument with no bar on a date gets NaN there.
 *
 * Features: open, high, low, close, volume, adj_close (falls back to close),
 * plus one `${FN}_${period}_${col}` frame per configured indicator, e.g.
 * `SMA_50_close`. An indicator on "close" is computed on adj_close, like the
 * Python engine.
 */
export class BarData implements InstrumentData {
  readonly instruments: string[];
  readonly dates: string[];
  private readonly features = new Map<string, Frame>();

  constructor(bars: Record<string, readonly DataBar[]>, indicators: readonly IndicatorSpec[] = []) {
    this.instruments = Object.keys(bars);
    const all = new Map<number, string>();
    const rows = new Map<string, Map<number, DataBar>>();
    for (const inst of this.instruments) {
      const byTime = new Map<number, DataBar>();
      for (const bar of bars[inst]!) {
        const t = toMs(bar.timestamp);
        if (Number.isNaN(t)) throw new Error(`Bad timestamp ${bar.timestamp} for ${inst}`);
        if (byTime.has(t)) throw new Error(`Duplicate bar at ${bar.timestamp} for ${inst}`);
        byTime.set(t, bar);
        if (!all.has(t)) all.set(t, bar.timestamp);
      }
      rows.set(inst, byTime);
    }
    const times = [...all.keys()].sort((a, b) => a - b);
    this.dates = times.map((t) => all.get(t)!);

    const pick = (bar: DataBar | undefined, field: PriceField): number => {
      if (!bar) return NaN;
      if (field === "adj_close") return bar.adjClose ?? bar.close;
      return bar[field] ?? NaN;
    };
    for (const field of PRICE_FIELDS) {
      const values = times.map((t) => this.instruments.map((inst) => pick(rows.get(inst)!.get(t), field)));
      this.features.set(field, new Frame(this.dates, this.instruments, values));
    }

    for (const spec of indicators) {
      const kernel = KERNELS[spec.function];
      if (!kernel) throw new Error(`Unknown indicator ${spec.function}`);
      for (const col of spec.priceCols) {
        const source = this.features.get(col === "close" ? "adj_close" : col);
        if (!source) throw new Error(`No price column ${col} for ${spec.function}`);
        for (const period of spec.params.periods) {
          const cols = Object.fromEntries(this.instruments.map((inst) => [inst, kernel(source.col(inst), period)]));
          this.features.set(`${spec.function}_${period}_${col}`, Frame.fromColumns(this.dates, cols));
        }
      }
    }
  }

  /** Fetch every instrument's bars (in parallel), then build. */
  static async fromFetch(
    instruments: readonly string[],
    fetch: BarFetcher,
    indicators: readonly IndicatorSpec[] = [],
  ): Promise<BarData> {
    const lists = await Promise.all(instruments.map((inst) => fetch(inst)));
    return new BarData(Object.fromEntries(instruments.map((inst, i) => [inst, lists[i]!])), indicators);
  }

  /** Every feature name this instance serves. */
  get featureNames(): string[] {
    return [...this.features.keys()];
  }

  getFeature(name: string): Frame {
    const frame = this.features.get(name);
    if (!frame) throw new Error(`Unknown feature ${name}. Available: ${this.featureNames.join(", ")}`);
    return frame;
  }

  /** The bars for one date, keyed by instrument, skipping instruments with no close. */
  barsAt(date: string): Record<string, Bar> {
    const i = this.dates.indexOf(date);
    const out: Record<string, Bar> = {};
    if (i < 0) return out;
    const get = (f: PriceField, j: number): number => this.features.get(f)!.values[i]![j]!;
    this.instruments.forEach((inst, j) => {
      const close = get("close", j);
      if (Number.isNaN(close)) return;
      const volume = get("volume", j);
      out[inst] = {
        timestamp: date,
        open: get("open", j),
        high: get("high", j),
        low: get("low", j),
        close,
        ...(Number.isNaN(volume) ? {} : { volume }),
      };
    });
    return out;
  }
}
