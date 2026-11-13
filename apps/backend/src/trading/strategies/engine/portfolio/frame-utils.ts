// Ported from backtester/portfolio/_time.py (QuantJourney Backtester, Apache 2.0)
//
// Dates are ISO strings ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS[Z|+hh:mm]"), so
// the tz normalization in _time.py reduces to exact-label reindexing here.

import { Frame } from '../../core/index';

export interface SeriesLike {
  readonly index: readonly string[];
  readonly values: readonly number[];
}

/** Parse an ISO date label to UTC milliseconds. Naive datetimes are read as UTC. */
export function dateMs(label: string): number {
  const s = label.trim();
  let ms: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) ms = Date.parse(`${s}T00:00:00Z`);
  else if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) ms = Date.parse(s);
  else ms = Date.parse(`${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) throw new Error(`Unparseable date label: ${label}`);
  return ms;
}

/** nan_to_num(x, nan=0, posinf=0, neginf=0). */
export const finiteOr0 = (v: number): number => (Number.isFinite(v) ? v : 0);

/** Reindex rows and columns by label; missing cells become NaN. */
export function reindexFrame(
  frame: Frame,
  index: readonly string[],
  columns: readonly string[],
): Frame {
  const rowPos = new Map(frame.index.map((d, i) => [d, i] as const));
  const colPos = columns.map((c) => frame.columns.indexOf(c));
  const values = index.map((d) => {
    const r = rowPos.get(d);
    if (r === undefined) return columns.map(() => NaN);
    const src = frame.values[r]!;
    return colPos.map((j) => (j < 0 ? NaN : src[j]!));
  });
  return new Frame(index, columns, values);
}

/** Reindex a series by label; missing labels become NaN. */
export function reindexSeries(
  series: SeriesLike,
  index: readonly string[],
): number[] {
  const pos = new Map(series.index.map((d, i) => [d, i] as const));
  return index.map((d) => {
    const i = pos.get(d);
    return i === undefined ? NaN : series.values[i]!;
  });
}

/** Forward-fill NaN down each column. */
export function ffillFrame(frame: Frame): Frame {
  const m = frame.columns.length;
  const last = new Array<number>(m).fill(NaN);
  const values = frame.values.map((row) =>
    row.map((v, j) => {
      if (!Number.isNaN(v)) last[j] = v;
      return last[j]!;
    }),
  );
  return new Frame(frame.index, frame.columns, values);
}

/** Forward-fill NaN in a 1-D array. */
export function ffill(xs: readonly number[]): number[] {
  let last = NaN;
  return xs.map((v) => {
    if (!Number.isNaN(v)) last = v;
    return last;
  });
}

/** First difference by row; row 0 is copied from the input (diff().fillna(first row)). */
export function diffRowsKeepFirst(frame: Frame): Frame {
  const values = frame.values.map((row, i) =>
    i === 0 ? row.slice() : row.map((v, j) => v - frame.values[i - 1]![j]!),
  );
  return new Frame(frame.index, frame.columns, values);
}

export function cumprod(xs: readonly number[]): number[] {
  let acc = 1;
  return xs.map((v) => (acc *= v));
}

/** Sample standard deviation (ddof = 1), numpy semantics. */
export function stdDdof1(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  let mean = 0;
  for (const x of xs) mean += x;
  mean /= n;
  let ss = 0;
  for (const x of xs) ss += (x - mean) * (x - mean);
  return Math.sqrt(ss / (n - 1));
}

/** numpy.isclose(a, b, rtol, atol) for scalars (NaN never close). */
export function isClose(
  a: number,
  b: number,
  rtol = 1e-5,
  atol = 1e-8,
): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= atol + rtol * Math.abs(b);
}

/** Leftmost insertion point (numpy searchsorted side="left"). */
export function bisectLeft(xs: readonly number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (xs[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Rightmost insertion point (numpy searchsorted side="right"). */
export function bisectRight(xs: readonly number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (xs[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
