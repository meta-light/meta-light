// Example WF 04: Grid Search Parameter Optimization
//
// Mode: weights + optimization.
// Idea: find the best SMA fast/slow window pair for a sector trend strategy
// with an exhaustive grid search. Each candidate is scored by running a real
// backtest and reading its annualized Sharpe.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Grid search evaluates every combination in a discrete grid. It is simple
// and complete, but cost grows with the product of the grid sizes; this grid
// is 3 x 3 = 9 candidates.
//
// The Python main() ran a GridSearchOptimizer over `paramGrid`, scoring each
// candidate with `evaluate` below (a full backtest per candidate, -999 when
// fast >= slow), then printed the best params, best Sharpe and the number of
// combinations evaluated. This template has no walk-forward step, so there is
// no WalkForwardConfig. Engine runs and printing are not ported.

import { crossAbove, equalWeightActive, type Frame, isNum, mean, pctChange, std, type StrategyConfig, WeightsStrategy } from "../core";

export type ParamGrid = Record<string, number[]>;

export interface GridSearchSpec {
  paramGrid: ParamGrid;
  objective: "sharpe";
}

export const gridSearch: GridSearchSpec = {
  paramGrid: {
    fast: [20, 50, 80],
    slow: [100, 150, 200],
  },
  objective: "sharpe",
};

/** Score returned for invalid candidates (fast >= slow). */
export const INVALID_SCORE = -999;

export function buildConfig(fast: number, slow: number): StrategyConfig {
  return {
    strategyName: `SMA_${fast}_${slow}`,
    initialCapital: 100_000,
    instruments: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"],
    backtestPeriod: { start: "2000-01-03", end: "2026-01-01" },
    benchmarkSymbol: "SPY",
    benchmarkName: "SPDR S&P 500 ETF Trust",
    source: "yfinance",
    executionMode: "weights",
    maxPositionSize: 0.25,
    rebalancePolicy: { frequency: "BME" },
    indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [fast, slow] } }],
  };
}

/** Annualized Sharpe of a NAV series (252 periods/year, zero risk-free rate). */
export function sharpe(nav: number[]): number {
  const returns = pctChange(nav).filter(isNum);
  const sd = std(returns);
  if (returns.length === 0 || sd === 0) return 0;
  return (mean(returns) / sd) * Math.sqrt(252);
}

/**
 * Objective for one candidate. `runNav` runs the backtest for the given
 * windows and returns its NAV series.
 */
export async function evaluate(
  params: { fast: number; slow: number },
  runNav: (fast: number, slow: number) => Promise<number[]>,
): Promise<number> {
  const fast = Math.trunc(params.fast);
  const slow = Math.trunc(params.slow);
  if (fast >= slow) return INVALID_SCORE;
  return sharpe(await runNav(fast, slow));
}

/** SMA crossover with tunable windows. */
export class SMACrossoverTunable extends WeightsStrategy {
  constructor(
    readonly fast: number,
    readonly slow: number,
    cfg: StrategyConfig = buildConfig(fast, slow),
  ) {
    super(cfg);
  }

  computeSignals(): Frame {
    return crossAbove(
      this.data.getFeature(`SMA_${this.fast}_close`),
      this.data.getFeature(`SMA_${this.slow}_close`),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
