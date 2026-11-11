// Example Weights 09: Intraday 1h SMA Trend
//
// Mode: weights.
// Idea: on hourly bars, hold each name only while its SMA(10) is above its
// SMA(30), equal weight across active names. A slower intraday-to-swing trend
// template.
// Universe: SPY, QQQ, IWM.
//
// 1h is the slowest cadence in the intraday grid (1m -> 5m -> 30m -> 1h).
// With ~7 bars per session it behaves like a fast swing strategy: lower
// turnover than the 1m/5m templates. Use it as the calm end of the grid to
// compare turnover and cost drag against the faster templates.
//
// The backtest window is pinned like the original. Swap in `recentPeriod(60)`
// from ../core for a rolling window.

import { crossAbove, equalWeightActive, type Frame, type StrategyConfig, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights09_IntradaySMATrend1h",
  strategyType: "Long / Cash",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2026-05-11", end: "2026-07-11" },
  granularity: "1h",
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: null, rebalanceOnSignalChange: true },
  indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [10, 30] } }],
};

/** Hourly SMA(10/30) trend/cash strategy. */
export class IntradaySMATrend1h extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature("SMA_10_close");
    const slow = this.data.getFeature("SMA_30_close");
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
