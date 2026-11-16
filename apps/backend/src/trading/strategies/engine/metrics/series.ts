import { isNum } from '../../core/index';

export interface Series {
  index: string[];
  values: number[];
}

export const makeSeries = (
  index: readonly string[],
  values: readonly number[],
): Series => ({
  index: [...index],
  values: [...values],
});

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

export function sortSeries(s: Series): Series {
  const order = s.index
    .map((_, i) => i)
    .sort((a, b) => toMs(s.index[a]!) - toMs(s.index[b]!));
  return {
    index: order.map((i) => s.index[i]!),
    values: order.map((i) => s.values[i]!),
  };
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

export function nanQuantile(xs: readonly number[], q: number): number {
  const sorted = xs.filter(isNum).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function cumprod(xs: readonly number[]): number[] {
  let acc = 1;
  return xs.map((v) => (isNum(v) ? (acc *= v) : NaN));
}

export function cummax(xs: readonly number[]): number[] {
  let acc = -Infinity;
  return xs.map((v) => (isNum(v) ? (acc = Math.max(acc, v)) : NaN));
}

export function toMs(raw: string): number {
  const date = raw.replace(' ', 'T');
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(date);
  return Date.parse(date.includes('T') && !hasZone ? `${date}Z` : date);
}

export function dayDiff(a: string, b: string): number {
  return Math.floor((toMs(b) - toMs(a)) / 86_400_000);
}

const pad = (n: number): string => String(n).padStart(2, '0');

const isoDate = (y: number, m: number, d: number): string =>
  `${y}-${pad(m)}-${pad(d)}`;

const monthEnd = (y: number, m: number): string =>
  isoDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());

export type ResampleRule = 'ME' | 'QE' | 'YE';

export function resample(
  s: Series,
  rule: ResampleRule,
  agg: (xs: number[]) => number,
): Series {
  if (!s.index.length) return { index: [], values: [] };
  const span = rule === 'ME' ? 1 : rule === 'QE' ? 3 : 12;
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

export function periodStarts(date: string): {
  month: number;
  quarter: number;
  year: number;
} {
  const d = new Date(toMs(date));
  const at = (month0: number, day: number): number =>
    Date.UTC(
      d.getUTCFullYear(),
      month0,
      day,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    );
  const m = d.getUTCMonth();
  return {
    month: at(m, 1),
    quarter: at(Math.floor(m / 3) * 3, 1),
    year: at(0, 1),
  };
}
