// Ported from backtester/engines/benchmark.py (QuantJourney Backtester, Apache 2.0).
//
// Benchmark returns and the comparison stats in the report. The warehouse SDK
// and yfinance fetchers are not ported; pass prices in from whatever data
// client you already use.

import { isNum } from '../../../../services/trading/strategies/core';
import {
  dropNaN,
  nanProd,
  periodStarts,
  type Series,
  sortSeries,
  toMs,
} from './series';

/** A price table for one symbol: column name -> values on a shared date index. */
export interface PriceTable {
  index: string[];
  columns: Record<string, number[]>;
}

/** Prefer adjusted prices, fall back to raw close. Null when neither exists. */
export function selectBenchmarkPrice(
  df: PriceTable | null | undefined,
): Series | null {
  if (!df || !df.index.length) return null;
  const byKey = new Map(
    Object.keys(df.columns).map((c) => [
      c.toLowerCase().split(' ').join('_'),
      c,
    ]),
  );
  for (const key of ['adj_close', 'adjclose', 'adjusted_close', 'close']) {
    const col = byKey.get(key);
    if (col !== undefined)
      return { index: [...df.index], values: [...df.columns[col]!] };
  }
  return null;
}

/**
 * Sort, then `pct_change()` with pandas' default forward fill: a gap in the
 * prices gives a 0 return, not NaN. Infinite values become NaN.
 */
export function priceToReturns(price: Series): Series {
  const sorted = sortSeries(price);
  let last = NaN;
  const filled = sorted.values.map((v) => (isNum(v) ? (last = v) : last));
  const values = filled.map((v, i) => {
    if (i === 0) return NaN;
    const r = v / filled[i - 1]! - 1;
    return Number.isFinite(r) ? r : NaN;
  });
  return { index: sorted.index, values };
}

/** Reindex onto the strategy dates. Missing bars stay NaN, never 0. */
export function alignBenchmarkReturns(
  benchmark: Series,
  returnsIndex: readonly string[],
): Series {
  const byDate = new Map(
    benchmark.index.map((d, i) => [toMs(d), benchmark.values[i]!]),
  );
  return {
    index: [...returnsIndex],
    values: returnsIndex.map((d) => byDate.get(toMs(d)) ?? NaN),
  };
}

/** Benchmark returns from locally held prices (`adj_close`, else close). */
export function localBenchmarkReturns(
  prices: PriceTable | null | undefined,
  returnsIndex: readonly string[],
): Series | null {
  const price = selectBenchmarkPrice(prices);
  return price
    ? alignBenchmarkReturns(priceToReturns(price), returnsIndex)
    : null;
}

export interface BenchmarkSummary {
  MTD: number;
  QTD: number;
  YTD: number;
  '1Y': number;
  '3Y': number;
  '5Y': number;
  ITD: number;
}

/** MTD, QTD, YTD, 1Y, 3Y/5Y annualized and ITD, in percent. Empty input gives null. */
export function computeBenchmarkSummary(
  returns: Series | null | undefined,
  periodsPerYear = 252,
): BenchmarkSummary | null {
  if (!returns || !returns.values.length) return null;
  const r = sortSeries(dropNaN(returns));
  if (!r.values.length) return null;
  const ppy = Math.max(Math.trunc(periodsPerYear || 252), 1);
  const compound = (xs: readonly number[]): number =>
    xs.length ? nanProd(xs.map((x) => 1 + x)) - 1 : NaN;
  const since = (startMs: number): number =>
    compound(r.values.filter((_, i) => toMs(r.index[i]!) >= startMs));
  const annualized = (periods: number): number =>
    r.values.length < periods
      ? NaN
      : nanProd(r.values.slice(-periods).map((x) => 1 + x)) ** (ppy / periods) -
        1;

  const starts = periodStarts(r.index[r.index.length - 1]!);
  return {
    MTD: since(starts.month) * 100,
    QTD: since(starts.quarter) * 100,
    YTD: since(starts.year) * 100,
    '1Y': compound(r.values.slice(-Math.min(ppy, r.values.length))) * 100,
    '3Y': annualized(ppy * 3) * 100,
    '5Y': annualized(ppy * 5) * 100,
    ITD: compound(r.values) * 100,
  };
}

/** Pairs of strategy/benchmark returns on dates where both are present. */
function alignPair(
  strategy: Series,
  benchmark: Series,
): { s: number[]; b: number[] } {
  const bench = new Map(
    benchmark.index.map((d, i) => [toMs(d), benchmark.values[i]!]),
  );
  const s: number[] = [];
  const b: number[] = [];
  strategy.index.forEach((d, i) => {
    const sv = strategy.values[i]!;
    const bv = bench.get(toMs(d));
    if (bv !== undefined && isNum(sv) && isNum(bv)) {
      s.push(sv);
      b.push(bv);
    }
  });
  return { s, b };
}

/** Final cumulative return of strategy minus benchmark, in percent. */
export function excessReturn(
  strategy: Series | null | undefined,
  benchmark: Series | null | undefined,
): number {
  if (!strategy || !benchmark) return NaN;
  const { s, b } = alignPair(strategy, benchmark);
  if (!s.length) return NaN;
  const total = (xs: number[]): number => nanProd(xs.map((x) => 1 + x)) - 1;
  return (total(s) - total(b)) * 100;
}

/** Annualized geometric active return (strategy CAGR minus benchmark CAGR), in percent. */
export function activeReturn(
  strategy: Series | null | undefined,
  benchmark: Series | null | undefined,
  periodsPerYear = 252,
): number {
  if (!strategy || !benchmark) return NaN;
  const { s, b } = alignPair(strategy, benchmark);
  if (s.length < 2) return NaN;
  const years = s.length / Math.max(Math.trunc(periodsPerYear || 252), 1);
  const ann = (xs: number[]): number =>
    nanProd(xs.map((x) => 1 + x)) ** (1 / years) - 1;
  return (ann(s) - ann(b)) * 100;
}
