// Example Weights 01: Daily SMA Trend
//
// Mode: weights.
// Idea: hold each sector ETF only when SMA(50) is above SMA(200).
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// The simplest weight-based template: compute binary signals, convert active
// names to equal weights, and let the engine translate weights to trades.

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights01_DailySMATrend',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: 'D' },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [50, 200] } },
  ],
};

/** Long/cash SMA(50/200) trend strategy with daily rebalancing. */
export class DailySMATrend extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('SMA_50_close');
    const slow = this.data.getFeature('SMA_200_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
