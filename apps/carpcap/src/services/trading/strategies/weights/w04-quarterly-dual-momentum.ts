// Example Weights 04: Quarterly Dual Momentum
//
// Mode: weights.
// Idea: rank ETFs by 12-month return, hold the top two only if return is positive.
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Dual momentum combines relative momentum (which asset is strongest) and
// absolute momentum (do not own it if its own trend is negative).

import { equalWeightActive, Frame, type StrategyConfig, topN, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights04_QuarterlyDualMomentum",
  strategyType: "Long / Cash",
  initialCapital: 100_000,
  instruments: ["SPY", "EFA", "EEM", "TLT", "IEF", "GLD", "DBC", "VNQ"],
  backtestPeriod: { start: "2007-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 0.5,
  rebalancePolicy: { frequency: "BQE" },
  indicators: [],
};

/** Quarterly relative-plus-absolute momentum ETF rotation. */
export class QuarterlyDualMomentum extends WeightsStrategy {
  static readonly LOOKBACK = 252;
  static readonly TOP_N = 2;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, TOP_N } = QuarterlyDualMomentum;
    const close = this.data.getFeature("adj_close");
    return Frame.full(close.index, close.columns, 0).mapRows((row, i) => {
      if (i < LOOKBACK) return row;
      // Absolute filter first (momentum > 0), then pick the strongest.
      const momentum = close.values[i]!.map((v, j) => v / close.values[i - LOOKBACK]![j]! - 1);
      const eligible = momentum.map((m) => (m > 0 ? m : NaN));
      const picks = new Set(topN(eligible, close.columns, TOP_N));
      return close.columns.map((c) => (picks.has(c) ? 1 : 0));
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.5);
  }
}
