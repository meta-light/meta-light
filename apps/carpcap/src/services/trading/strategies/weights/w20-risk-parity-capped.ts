// Example Weights 20: Risk Parity With Position Cap (Chained Overlays)
//
// Mode: weights + chained risk overlays.
// Idea: equal-risk-contribution across US sector ETFs, then a hard
// per-position cap so no single sector dominates. This shows how to chain risk
// models: risk parity first, position limit second.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Risk overlay: risk parity (126-bar) then a 25% position limit. ERC weights
// are computed, then capped at 25% each and renormalized. The longer
// covariance window makes the ERC estimate steadier than the multi-asset
// example.

import { equalWeightActive, Frame, type StrategyConfig, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights20_RiskParityCapped",
  strategyType: "Long Only",
  initialCapital: 100_000,
  instruments: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"],
  backtestPeriod: { start: "2000-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: "BME" },
  riskModel: {
    type: "chain",
    models: [
      { type: "risk_parity", lookback: 126 },
      { type: "position_limit", maxWeight: 0.25 },
    ],
  },
  indicators: [],
};

/** Sector ERC portfolio with a per-position cap. */
export class RiskParityCapped extends WeightsStrategy {
  static readonly WARMUP = 126;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature("adj_close");
    return Frame.full(close.index, close.columns, 0).map((_, i) => (i >= RiskParityCapped.WARMUP ? 1 : 0));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals);
  }
}
