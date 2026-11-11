// Example Weights 18: Volatility-Targeted Momentum Basket
//
// Mode: weights + risk overlay.
// Idea: hold a momentum-selected basket (top names by 6-month return) and
// scale it to a 15% annualized volatility target, allowing modest leverage. A
// different base strategy and a higher target than the trend example, to show
// how the same overlay adapts.
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Risk overlay: vol target 15%, 42-bar lookback, max leverage 2.0. The base
// picks the strongest assets; the overlay decides how much to hold.

import { equalWeightActive, Frame, type StrategyConfig, topN, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights18_VolTargetMomentum",
  strategyType: "Long / Cash",
  initialCapital: 100_000,
  instruments: ["SPY", "EFA", "EEM", "TLT", "IEF", "GLD", "DBC", "VNQ"],
  backtestPeriod: { start: "2007-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 0.4,
  rebalancePolicy: { frequency: "BME" },
  riskModel: { type: "vol_target", targetVol: 0.15, lookback: 42, maxLeverage: 2.0 },
  indicators: [],
};

/** Momentum basket scaled to a volatility target. */
export class VolTargetMomentum extends WeightsStrategy {
  static readonly LOOKBACK = 126;
  static readonly TOP_N = 3;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, TOP_N } = VolTargetMomentum;
    const close = this.data.getFeature("adj_close");
    const cols = close.columns;
    return Frame.full(close.index, cols, 0).mapRows((row, i) => {
      if (i < LOOKBACK) return row;
      // Only positive momentum qualifies; NaN and <= 0 are dropped.
      const momentum = close.values[i]!.map((v, j) => {
        const m = v / close.values[i - LOOKBACK]![j]! - 1;
        return m > 0 ? m : NaN;
      });
      const picks = topN(momentum, cols, TOP_N, "largest");
      return cols.map((c) => (picks.includes(c) ? 1 : 0));
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.4);
  }
}
