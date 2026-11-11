// Ported from backtester/walkforward/optimization/base.py (QuantJourney Backtester, Apache 2.0)
//
// Python's protocol takes a backtester factory plus train dates and builds
// each trial's backtest itself. Here the caller (the walk-forward runner)
// closes over those and hands the optimizer a plain objective callback.

import type { OptimizationResult, Params } from "./result";

/** Scores one parameter set; higher is better. Throwing marks the trial FAIL. */
export type Objective = (params: Params) => number | Promise<number>;

export interface OptimizationProgress {
  trial: number;
  total: number;
  value: number;
  best: number;
  params: Params;
  /** Seconds since the search started, rounded to 0.1. */
  elapsed: number;
}

export interface OptimizeOptions {
  progressCallback?: (progress: OptimizationProgress) => void;
  /** Checked before each trial; returning true stops the search. */
  cancelCheck?: () => boolean;
}

export interface Optimizer {
  optimize(objective: Objective, options?: OptimizeOptions): Promise<OptimizationResult>;
}
