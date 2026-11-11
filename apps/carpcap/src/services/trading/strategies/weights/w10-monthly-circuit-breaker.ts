// Example Weights 10: Monthly Trend With Circuit Breaker
//
// Mode: weights.
// Idea: SMA(50/200) trend on a diversified ETF basket, rebalanced monthly,
// with a circuit breaker that flattens the book on a large drawdown and waits
// out a cooldown before re-engaging.
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Demonstrates the risk-off layer of the rebalance engine: normal months
// rebalance on the calendar, but a 15% drawdown flattens exposure and a
// 10-day cooldown prevents whipsaw re-entry.

import { crossAbove, equalWeightActive, type Frame, type StrategyConfig, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights10_MonthlyCircuitBreaker",
  strategyType: "Long / Cash",
  initialCapital: 100_000,
  instruments: ["SPY", "EFA", "EEM", "TLT", "IEF", "GLD", "DBC", "VNQ"],
  backtestPeriod: { start: "2007-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 0.3,
  rebalancePolicy: {
    frequency: "BME",
    maxDrawdownTrigger: 0.15, // flatten if drawdown exceeds 15%
    maxDrawdownAction: "flatten",
    circuitBreakerCooldownDays: 10, // wait 10 trading days before re-engaging
  },
  indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [50, 200] } }],
};

/** Monthly ETF trend with a drawdown circuit breaker. */
export class MonthlyCircuitBreaker extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature("SMA_50_close");
    const slow = this.data.getFeature("SMA_200_close");
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.3);
  }
}
