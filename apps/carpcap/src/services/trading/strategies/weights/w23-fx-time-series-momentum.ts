// Example Weights 23: FX Time-Series Momentum
//
// Mode: weights (price-return research proxy).
// Idea: trade each USD-quoted spot-FX pair in the direction of its six-month
// momentum and scale active signals by inverse 63-day volatility.
// Universe: EURUSD, GBPUSD, AUDUSD and NZDUSD provider spot-FX proxies.
//
// This tests FX data and portfolio logic. Weights mode does not model standard
// lots, FX margin, rollover/swap points, bid/ask spread, or conversion of
// non-USD PnL. Use the order example for contract-aware lot sizing.

import { type Frame, isNum, type StrategyConfig, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights23_FXTimeSeriesMomentum",
  strategyType: "Long / Short FX Proxy",
  initialCapital: 500_000,
  instruments: ["EURUSD=X", "GBPUSD=X", "AUDUSD=X", "NZDUSD=X"],
  backtestPeriod: { start: "2010-01-04", end: "2026-01-01" },
  benchmarkSymbol: "DX-Y.NYB",
  benchmarkName: "US Dollar Index",
  source: "yfinance",
  executionMode: "weights",
  rebalancePolicy: { frequency: "BME" },
  indicators: [],
};

/**
 * Scale each row so absolute weights sum to 1 (`raw.div(raw.abs().sum(axis=1)
 * .replace(0, nan), axis=0).fillna(0)`). NaN cells end up as 0.
 */
export function unitGross(raw: Frame): Frame {
  const gross = raw.map(Math.abs).rowSum().map((g) => (g === 0 ? NaN : g));
  return raw.divRows(gross).fillNaN(0);
}

/** Direction signals and unit-gross inverse-volatility weights. */
export function buildFxTimeSeriesMomentum(
  close: Frame,
  { momentumLookback = 126, volatilityLookback = 63 } = {},
): { signals: Frame; weights: Frame } {
  const momentum = close.pctChange(momentumLookback);
  const signals = momentum.map((m) => (isNum(m) ? Math.sign(m) : 0));
  const volatility = close
    .pctChange()
    .rollingStd(volatilityLookback)
    .map((v) => v * Math.sqrt(252));
  const inverseVol = volatility.map((v) => (v === 0 ? NaN : 1 / v));
  const raw = signals.zip(inverseVol, (s, iv) => s * iv);
  return { signals, weights: unitGross(raw) };
}

/** Six-month FX trend with inverse-volatility sizing. */
export class FXTimeSeriesMomentum extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    return buildFxTimeSeriesMomentum(this.data.getFeature("adj_close")).signals;
  }

  computeWeights(): Frame {
    return buildFxTimeSeriesMomentum(this.data.getFeature("adj_close")).weights;
  }
}
