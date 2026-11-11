// Example Weights 19: Risk Parity (Multi-Asset ERC)
//
// Mode: weights + risk overlay.
// Idea: hold a diversified multi-asset basket, but size positions so each
// asset contributes equal risk (equal risk contribution, ERC) rather than
// equal dollars. Low-volatility assets (bonds) get more capital;
// high-volatility assets (equities, commodities) get less.
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Base: stay invested in all assets after warm-up (equal target weights).
// Risk overlay: a 63-bar risk parity model replaces the equal weights with ERC
// weights estimated on a strictly prior covariance window (no look-ahead).

import { equalWeightActive, Frame, type StrategyConfig, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights19_RiskParityMultiAsset",
  strategyType: "Long Only",
  initialCapital: 100_000,
  instruments: ["SPY", "EFA", "EEM", "TLT", "IEF", "GLD", "DBC", "VNQ"],
  backtestPeriod: { start: "2007-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: "BME" },
  riskModel: { type: "risk_parity", lookback: 63 },
  indicators: [],
};

/** Equal-risk-contribution multi-asset portfolio. */
export class RiskParityMultiAsset extends WeightsStrategy {
  static readonly WARMUP = 63;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature("adj_close");
    return Frame.full(close.index, close.columns, 0).map((_, i) => (i >= RiskParityMultiAsset.WARMUP ? 1 : 0));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals);
  }
}
