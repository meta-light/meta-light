// Example Weights 11: Quarterly Momentum With Tracking-Error and Cost Gate
//
// Mode: weights.
// Idea: quarterly momentum rotation on a broad ETF universe, layered with a
// tracking-error trigger (rebalance early if the book drifts too far from the
// benchmark) and an annual-turnover budget (a cost gate that suppresses
// trading once the rolling turnover budget is spent).
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Demonstrates two rebalance layers useful for institutional mandates:
// staying within a tracking-error band vs a benchmark, and respecting a
// turnover budget so the strategy doesn't trade itself to death.

import { equalWeightActive, Frame, type StrategyConfig, topN, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights11_QuarterlyTECostGate",
  strategyType: "Long Only",
  initialCapital: 100_000,
  instruments: ["SPY", "EFA", "EEM", "TLT", "IEF", "GLD", "DBC", "VNQ"],
  backtestPeriod: { start: "2007-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 0.4,
  rebalancePolicy: {
    frequency: "BQE",
    trackingErrorThreshold: 0.06, // rebalance early if annualized TE vs benchmark > 6%
    trackingErrorWindow: 63,
    maxAnnualTurnover: 4.0, // cost gate: cap rolling 252d turnover at 4x
  },
  indicators: [],
};

/** Quarterly momentum with TE trigger and turnover budget. */
export class QuarterlyTECostGate extends WeightsStrategy {
  static readonly LOOKBACK = 126; // ~6 months of trading days
  static readonly TOP_N = 3;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, TOP_N } = QuarterlyTECostGate;
    const close = this.data.getFeature("adj_close");
    return Frame.full(close.index, close.columns, 0).mapRows((row, i) => {
      if (i < LOOKBACK) return row;
      const momentum = close.values[i]!.map((v, j) => v / close.values[i - LOOKBACK]![j]! - 1);
      const picks = new Set(topN(momentum, close.columns, TOP_N));
      return close.columns.map((c) => (picks.has(c) ? 1 : 0));
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.4);
  }
}
