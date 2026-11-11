// Example WF 01: Rolling Walk-Forward
//
// Mode: weights + walk-forward.
// Idea: run an SMA(50/200) long/cash sector trend once, then score it with a
// rolling walk-forward (24-month train, 6-month test, 6-month step, 5-day
// purge plus a 1% extra pre-OOS purge).
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// The Python main() ran the full backtest, then a WalkForwardEngine over its
// NAV. In "slice_diagnostics" mode the folds are in-sample slices of that one
// run (indicative only); in "per_fold_refit" mode the engine rebuilds the
// strategy per fold via buildConfig() for true out-of-sample results. It then
// printed the summary and traffic-light verdicts for overfit ratio,
// efficiency and Sharpe decay. Engine runs and printing are not ported.

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  type WalkForwardConfig,
  type WalkForwardMode,
  WeightsStrategy,
} from "../core";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function envFlag(name: string): boolean {
  return TRUTHY.has((process.env[name] ?? "").trim().toLowerCase());
}

/** QJ_WF_MODE=per_fold_refit|refit|true_oos or QJ_WF_REFIT=1 selects per-fold refits. */
export function walkForwardMode(): WalkForwardMode {
  const raw = (process.env.QJ_WF_MODE ?? "").trim().toLowerCase();
  if (["per_fold_refit", "refit", "true_oos"].includes(raw) || envFlag("QJ_WF_REFIT")) {
    return "per_fold_refit";
  }
  return "slice_diagnostics";
}

export const walkForwardConfig: WalkForwardConfig = {
  scheme: "rolling",
  trainMonths: 24,
  testMonths: 6,
  stepMonths: 6,
  purgeDays: 5,
  extraPreOosPurgePct: 0.01,
};

/** Per-fold names follow `${name}_Fold01`, with backtestPeriod {trainStart, oosEnd}. */
export function buildConfig({
  strategyName = "ExampleWF01_RollingWalkForward",
  backtestPeriod = { start: "2000-01-03", end: "2026-01-01" },
}: { strategyName?: string; backtestPeriod?: { start: string; end: string } } = {}): StrategyConfig {
  return {
    strategyName,
    strategyType: "Long / Cash",
    initialCapital: 100_000,
    instruments: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"],
    backtestPeriod,
    benchmarkSymbol: "SPY",
    benchmarkName: "SPDR S&P 500 ETF Trust",
    source: "yfinance",
    executionMode: "weights",
    maxPositionSize: 0.25,
    rebalancePolicy: { frequency: "BME" },
    indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [50, 200] } }],
  };
}

/** SMA(50/200) long/cash trend, used as the walk-forward subject. */
export class SMATrendForWF extends WeightsStrategy {
  constructor(cfg: StrategyConfig = buildConfig()) {
    super(cfg);
  }

  computeSignals(): Frame {
    return crossAbove(this.data.getFeature("SMA_50_close"), this.data.getFeature("SMA_200_close"));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
