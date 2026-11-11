// Example WF 05: Optuna TPE Optimization + Walk-Forward Check
//
// Mode: weights + optimization + walk-forward.
// Idea: search SMA fast/slow windows for a sector trend strategy with
// Optuna's TPE sampler (30 trials, median pruner, seed 42) instead of an
// exhaustive grid, then validate the winner with a rolling walk-forward.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// The strategy, config builder, Sharpe objective and evaluate() are the same
// as WF 04, so they are re-exported from there.
//
// The Python main() ran the Optuna optimizer over `optunaSearch`, scoring
// each trial with a full backtest's annualized Sharpe (-999 when
// fast >= slow), re-ran the best params, ran a WalkForwardEngine with
// `walkForwardConfig` over that NAV, and printed the best params plus
// traffic-light verdicts for overfit ratio, efficiency and Sharpe decay.
// Engine runs and printing are not ported.

import type { WalkForwardConfig } from "../core";

export { buildConfig, evaluate, INVALID_SCORE, SMACrossoverTunable, sharpe } from "./wf04-grid-search-optimization";

export type ParamSpace = Record<string, { type: "int"; low: number; high: number }>;

export type ParamConstraint = { type: "less_than"; param: string; than: string };

export interface OptunaSpec {
  paramSpace: ParamSpace;
  nTrials: number;
  sampler: "tpe";
  pruner: "median";
  seed: number;
  constraints: ParamConstraint[];
}

export const optunaSearch: OptunaSpec = {
  paramSpace: {
    fast: { type: "int", low: 10, high: 80 },
    slow: { type: "int", low: 100, high: 250 },
  },
  nTrials: 30,
  sampler: "tpe",
  pruner: "median",
  seed: 42,
  constraints: [{ type: "less_than", param: "fast", than: "slow" }],
};

/** Out-of-sample check applied to the best parameters. */
export const walkForwardConfig: WalkForwardConfig = {
  scheme: "rolling",
  trainMonths: 24,
  testMonths: 6,
  stepMonths: 6,
  purgeDays: 5,
  extraPreOosPurgePct: 0.01,
};
