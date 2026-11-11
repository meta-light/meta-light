// Ported from backtester/portfolio/calc/returns.py and calc/risk.py
// (QuantJourney Backtester, Apache 2.0).
//
// A dated 1-D series plus the pandas reductions the metrics rely on. pandas
// skips NaN in sum/prod/mean/std/min/max/cumprod/cummax, so these do too.

import { isNum } from "../../core";

/** A pandas Series with a date index. Missing values are NaN. */
export interface Series {
  index: string[];
  values: number[];
}

export const makeSeries = (index: readonly string[], values: readonly number[]): Series => ({
  index: [...index],
  values: [...values],
});

/** `s.replace([inf, -inf], nan).dropna()`. */
export function dropNaN(s: Series): Series {
  const index: string[] = [];
  const values: number[] = [];
  s.values.forEach((v, i) => {
    if (Number.isFinite(v)) {
      index.push(s.index[i]!);
      values.push(v);
    }
  });
  return { index, values };
}

/** Sort a series by its date index. */
export function sortSeries(s: Series): Series {
  const order = s.index.map((_, i) => i).sort((a, b) => toMs(s.index[a]!) - toMs(s.index[b]!));
  return { index: order.map((i) => s.index[i]!), values: order.map((i) => s.values[i]!) };
}

export function nanSum(xs: readonly number[]): number {
  let total = 0;
  for (const v of xs) if (isNum(v)) total += v;
  return total;
}

export function nanProd(xs: readonly number[]): number {
  let total = 1;
  for (const v of xs) if (isNum(v)) total *= v;
  return total;
}

export function nanMean(xs: readonly number[]): number {
  const valid = xs.filter(isNum);
  return valid.length ? nanSum(valid) / valid.length : NaN;
}

/** Sample std (ddof=1) over non-NaN values. */
export function nanStd(xs: readonly number[]): number {
  const valid = xs.filter(isNum);
  if (valid.length < 2) return NaN;
  const m = nanSum(valid) / valid.length;
  let sq = 0;
  for (const v of valid) sq += (v - m) ** 2;
  return Math.sqrt(sq / (valid.length - 1));
}

export function nanMin(xs: readonly number[]): number {
  const valid = xs.filter(isNum);
  return valid.length ? Math.min(...valid) : NaN;
}

export function nanMax(xs: readonly number[]): number {
  const valid = xs.filter(isNum);
  return valid.length ? Math.max(...valid) : NaN;
}

/** `s.quantile(q)` with linear interpolation, NaN skipped. */
export function nanQuantile(xs: readonly number[], q: number): number {
  const sorted = xs.filter(isNum).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** `s.cumprod()`: NaN positions stay NaN and are skipped. */
export function cumprod(xs: readonly number[]): number[] {
  let acc = 1;
  return xs.map((v) => (isNum(v) ? (acc *= v) : NaN));
}

/** `s.cummax()`: NaN positions stay NaN and are skipped. */
export function cummax(xs: readonly number[]): number[] {
  let acc = -Infinity;
  return xs.map((v) => (isNum(v) ? (acc = Math.max(acc, v)) : NaN));
}

// --- Dates ------------------------------------------------------------------

/** Parse an ISO date as UTC, so "2024-01-02" and "2024-01-02T09:30" agree. */
export function toMs(raw: string): number {
  const date = raw.replace(" ", "T");
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(date);
  return Date.parse(date.includes("T") && !hasZone ? `${date}Z` : date);
}

/** Whole days from `a` to `b` (`(b - a).days`). */
export function dayDiff(a: string, b: string): number {
  return Math.floor((toMs(b) - toMs(a)) / 86_400_000);
}

const pad = (n: number): string => String(n).padStart(2, "0");

const isoDate = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

/** Last calendar day of a month (1-based month). */
const monthEnd = (y: number, m: number): string => isoDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());

export type ResampleRule = "ME" | "QE" | "YE";

/**
 * `s.resample(rule).apply(agg)`. Bins run from the first to the last period
 * with no gaps, labelled with the period-end date like pandas. Empty bins get
 * `agg([])`, so `(1 + x).prod() - 1` gives 0 there, as in pandas.
 */
export function resample(s: Series, rule: ResampleRule, agg: (xs: number[]) => number): Series {
  if (!s.index.length) return { index: [], values: [] };
  const span = rule === "ME" ? 1 : rule === "QE" ? 3 : 12;
  const keyOf = (date: string): number => {
    const d = new Date(toMs(date));
    return d.getUTCFullYear() * 12 + Math.floor(d.getUTCMonth() / span) * span;
  };
  const buckets = new Map<number, number[]>();
  s.index.forEach((date, i) => {
    const k = keyOf(date);
    const bucket = buckets.get(k) ?? [];
    bucket.push(s.values[i]!);
    buckets.set(k, bucket);
  });
  const keys = [...buckets.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const index: string[] = [];
  const values: number[] = [];
  for (let k = first; k <= last; k += span) {
    const endMonth0 = (k % 12) + span - 1;
    index.push(monthEnd(Math.floor(k / 12), endMonth0 + 1));
    values.push(agg(buckets.get(k) ?? []));
  }
  return { index, values };
}

/** Start of the month, quarter and year containing `date`, keeping its time of day. */
export function periodStarts(date: string): { month: number; quarter: number; year: number } {
  const d = new Date(toMs(date));
  const at = (month0: number, day: number): number =>
    Date.UTC(d.getUTCFullYear(), month0, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  const m = d.getUTCMonth();
  return { month: at(m, 1), quarter: at(Math.floor(m / 3) * 3, 1), year: at(0, 1) };
}
