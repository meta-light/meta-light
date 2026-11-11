// Ported from backtester/walkforward/statistics/aggregation.py (QuantJourney Backtester, Apache 2.0)
//
// Stitch per-fold OOS returns into one composite series and score it.

import { mean, std } from "../../../core";
import { seededRandom } from "../internal";

/** A dated series (pandas Series stand-in): `values[i]` belongs to ISO date `index[i]`. */
export interface DatedSeries {
  index: string[];
  values: number[];
}

/**
 * Concatenate per-fold OOS returns, sort by date and build NAV = cumprod(1 + r).
 * Overlapping dates (step < test) are averaged across folds with a warning.
 */
export function aggregateOosReturns(foldOosReturns: readonly DatedSeries[]): { returns: DatedSeries; nav: DatedSeries } {
  const byDate = new Map<string, number[]>();
  let duplicated = false;
  for (const s of foldOosReturns) {
    s.index.forEach((d, i) => {
      const bucket = byDate.get(d);
      if (bucket) {
        duplicated = true;
        bucket.push(s.values[i]!);
      } else {
        byDate.set(d, [s.values[i]!]);
      }
    });
  }
  if (duplicated) {
    console.warn(
      "Overlapping OOS windows detected (step < test): duplicated dates are averaged across folds. " +
        "With per-fold refit this blends differently parameterized strategies and biases the composite " +
        "Sharpe upward; prefer stepMonths >= testMonths for a realized equity curve.",
    );
  }
  const index = [...byDate.keys()].sort();
  const values = index.map((d) => {
    const bucket = byDate.get(d)!;
    return bucket.length === 1 ? bucket[0]! : mean(bucket);
  });
  let level = 1;
  const nav = values.map((r) => (level *= 1 + r));
  return { returns: { index, values }, nav: { index: index.slice(), values: nav } };
}

export interface CompositeMetrics {
  sharpe: number;
  cagr: number;
  maxDd: number;
  volatility: number;
}

/** Sharpe, CAGR, max drawdown and volatility of a composite daily return series. */
export function computeCompositeMetrics(
  oosReturns: readonly number[],
  riskFreeRate = 0,
  tradingDays = 252,
): CompositeMetrics {
  const n = oosReturns.length;
  if (n === 0) return { sharpe: 0, cagr: 0, maxDd: 0, volatility: 0 };
  const years = n / tradingDays;
  const growth = oosReturns.reduce((p, r) => p * (1 + r), 1);
  const cagr = growth ** (1 / Math.max(years, 1e-9)) - 1;
  const sd = std(oosReturns); // NaN for a single observation, as in pandas
  const ann = Math.sqrt(tradingDays);
  const excess = mean(oosReturns) - riskFreeRate / tradingDays;
  const sharpe = sd > 0 ? (excess / sd) * ann : 0;
  let nav = 1;
  let peak = -Infinity;
  let maxDd = Infinity;
  for (const r of oosReturns) {
    nav *= 1 + r;
    peak = Math.max(peak, nav);
    maxDd = Math.min(maxDd, (nav - peak) / peak);
  }
  return { sharpe, cagr, maxDd, volatility: sd * ann };
}

/** numpy.percentile with the default linear interpolation. */
function percentile(sorted: readonly number[], q: number): number {
  const pos = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * 5th / 95th percentile of the annualized Sharpe under a stationary block
 * bootstrap (Politis and Romano), expected block length round(sqrt(T)).
 * null when T < 20, any value is non-finite, or volatility is zero.
 * The RNG is seeded but differs from numpy's `default_rng`, so the interval
 * matches Python statistically, not bit for bit.
 */
export function bootstrapSharpeCi(
  returns: readonly number[],
  options: { nResamples?: number; seed?: number; riskFreeRate?: number; tradingDays?: number } = {},
): [number, number] | null {
  const { nResamples = 1000, seed = 42, riskFreeRate = 0, tradingDays = 252 } = options;
  const t = returns.length;
  if (t < 20 || !returns.every(Number.isFinite) || std(returns) === 0) return null;
  const rand = seededRandom(seed);
  const pRestart = 1 / Math.max(1, Math.round(Math.sqrt(t)));
  const rfrDaily = riskFreeRate / tradingDays;
  const ann = Math.sqrt(tradingDays);
  const sample = new Array<number>(t);
  const sharpes: number[] = [];
  for (let i = 0; i < nResamples; i += 1) {
    let idx = 0;
    for (let p = 0; p < t; p += 1) {
      idx = p === 0 || rand() < pRestart ? Math.floor(rand() * t) : (idx + 1) % t;
      sample[p] = returns[idx]!;
    }
    const sd = std(sample);
    sharpes.push(sd > 0 ? ((mean(sample) - rfrDaily) / sd) * ann : 0);
  }
  sharpes.sort((a, b) => a - b);
  return [percentile(sharpes, 5), percentile(sharpes, 95)];
}
