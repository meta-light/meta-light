// Ported from backtester/walkforward/optimization/grid.py (QuantJourney Backtester, Apache 2.0)
//
// Grids larger than `maxCombinations` are randomly subsampled with a seeded
// RNG. That RNG is not Python's `random.Random`, so for oversized grids the
// sampled subset differs from the Python original (full grids are evaluated
// identically).

import { mean, std } from '../../../core/index';
import { sampleWithoutReplacement, seededRandom } from '../internal';
import type { Objective, OptimizeOptions, Optimizer } from './base';
import {
  OptimizationResult,
  type Params,
  type TrialRecord,
  type TrialState,
} from './result';

export interface GridSearchOptions {
  maxCombinations?: number;
  seed?: number;
}

export class GridSearchOptimizer implements Optimizer {
  private readonly maxCombinations: number;
  private readonly seed: number;

  constructor(
    private readonly paramGrid: Record<string, readonly unknown[]> = {},
    options: GridSearchOptions = {},
  ) {
    this.maxCombinations = options.maxCombinations ?? 500;
    this.seed = options.seed ?? 42;
  }

  /** Cartesian product in grid key order (last key varies fastest), subsampled if too large. */
  combinations(): Params[] {
    const keys = Object.keys(this.paramGrid);
    let combos: Params[] = [{}];
    for (const key of keys) {
      const next: Params[] = [];
      for (const combo of combos)
        for (const value of this.paramGrid[key]!)
          next.push({ ...combo, [key]: value });
      combos = next;
    }
    if (combos.length > this.maxCombinations) {
      combos = sampleWithoutReplacement(
        combos,
        this.maxCombinations,
        seededRandom(this.seed),
      );
    }
    return combos;
  }

  async optimize(
    objective: Objective,
    options: OptimizeOptions = {},
  ): Promise<OptimizationResult> {
    const { progressCallback, cancelCheck } = options;
    const t0 = performance.now();
    const combos = this.combinations();
    const trials: TrialRecord[] = [];
    let bestScore = -Infinity;
    let bestParams: Params = {};

    for (let i = 0; i < combos.length; i += 1) {
      if (cancelCheck?.()) break;
      const params = combos[i]!;
      const trialT0 = performance.now();
      let score: number;
      let state: TrialState;
      try {
        score = Number(await objective(params));
        state = 'COMPLETE';
      } catch (e) {
        console.warn(
          `Grid trial ${i} failed for ${JSON.stringify(params)}: ${e instanceof Error ? e.message : String(e)}`,
        );
        score = -Infinity;
        state = 'FAIL';
      }
      trials.push({
        number: i,
        params,
        value: score,
        durationSeconds: (performance.now() - trialT0) / 1000,
        pruned: false,
        state,
      });
      if (state === 'COMPLETE' && score > bestScore) {
        bestScore = score;
        bestParams = { ...params };
      }
      progressCallback?.({
        trial: i,
        total: combos.length,
        value: score,
        best: bestScore,
        params,
        elapsed: Math.round((performance.now() - t0) / 100) / 10,
      });
    }
    return finalize(
      trials,
      bestParams,
      bestScore,
      (performance.now() - t0) / 1000,
    );
  }
}

function finalize(
  trials: TrialRecord[],
  bestParams: Params,
  bestScore: number,
  elapsed: number,
): OptimizationResult {
  const nCompleted = trials.filter((t) => t.state === 'COMPLETE').length;
  const nFailed = trials.filter((t) => t.state === 'FAIL').length;
  const allFailed = trials.length > 0 && nCompleted === 0;
  if (allFailed) {
    console.error(
      `GridSearchOptimizer: ALL ${trials.length} trials failed; bestParams is empty and the fold will run unoptimized.`,
    );
  }
  return new OptimizationResult({
    bestParams,
    bestObjective: bestScore,
    nEvaluated: trials.length,
    elapsedSeconds: elapsed,
    allResults: trials.map((t) => ({ ...t.params, objective: t.value })),
    trials,
    nCompleted,
    nFailed,
    allTrialsFailed: allFailed,
  });
}

/**
 * Annualized Sharpe of daily NAV returns, the score Python's grid uses when it
 * runs the backtest itself (`_evaluate_backtest`). 0 when fewer than 2 returns
 * or zero volatility.
 */
export function sharpeFromNav(
  nav: readonly number[],
  tradingDays = 252,
): number {
  const returns: number[] = [];
  for (let i = 1; i < nav.length; i += 1) {
    const r = nav[i]! / nav[i - 1]! - 1;
    if (!Number.isNaN(r)) returns.push(r);
  }
  if (returns.length < 2) return 0;
  const sd = std(returns);
  if (sd === 0) return 0;
  return (mean(returns) / sd) * Math.sqrt(tradingDays);
}
