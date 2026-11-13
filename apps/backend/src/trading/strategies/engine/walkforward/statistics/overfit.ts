// Ported from backtester/walkforward/statistics/overfit.py (QuantJourney Backtester, Apache 2.0)

import { mean } from '../../../core/index';

/**
 * IS Sharpe / OOS Sharpe. Above 1.5 is caution, above 2.5 likely overfit.
 * Infinity when OOS <= 0 and IS > 0; 0 when both are <= 0. Not interpretable
 * when OOS <= 0 or IS < 0, which is why `interpretMetrics` gates on the
 * composite OOS Sharpe.
 */
export function overfitRatio(isSharpe: number, oosSharpe: number): number {
  if (oosSharpe <= 0) return isSharpe > 0 ? Infinity : 0;
  return isSharpe / oosSharpe;
}

/** OOS CAGR / IS CAGR. 1.0 is perfect transfer, below 0.4 a red flag. 0 when IS CAGR <= 0. */
export function efficiency(isCagr: number, oosCagr: number): number {
  if (isCagr <= 0) return 0;
  return oosCagr / isCagr;
}

/**
 * Least-squares slope of OOS Sharpe across folds; negative means decaying
 * alpha. 0 with fewer than 2 folds. A positive slope on an always-losing
 * strategy is not health, see `interpretMetrics`.
 */
export function sharpeDecay(oosSharpes: readonly number[]): number {
  const n = oosSharpes.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(oosSharpes);
  let num = 0;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xMean) * (oosSharpes[i]! - yMean);
    denom += (i - xMean) ** 2;
  }
  return denom === 0 ? 0 : num / denom;
}

/** Mean IS Sharpe / mean OOS Sharpe across folds. */
export function aggregateOverfitRatio(
  isSharpes: readonly number[],
  oosSharpes: readonly number[],
): number {
  return overfitRatio(mean(isSharpes), mean(oosSharpes));
}

/** Mean OOS CAGR / mean IS CAGR across folds. */
export function aggregateEfficiency(
  isCagrs: readonly number[],
  oosCagrs: readonly number[],
): number {
  return efficiency(mean(isCagrs), mean(oosCagrs));
}
