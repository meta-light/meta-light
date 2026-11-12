// Example Weights 08: Intraday 1m EMA Scalp
//
// Mode: weights.
// Idea: hold each name only while its fast EMA(9) is above its slow EMA(21) on
// 1-minute bars. A fast, high-turnover trend-follow / scalp template.
// Universe: SPY, QQQ, IWM.
//
// Fastest cadence in the intraday grid (1m -> 5m -> 30m -> 1h). At 1m,
// turnover is high and costs dominate, so this is mostly a stress test of the
// engine's intraday timestamp handling and signal-change rebalancing.
//
// The backtest window is pinned like the original. Swap in `recentPeriod(5)`
// from ../core for a rolling window (yfinance serves ~7 days of 1m bars).

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights08_IntradayEMAScalp1m',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2026-07-05', end: '2026-07-11' },
  granularity: '1m',
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.34,
  rebalancePolicy: { frequency: null, rebalanceOnSignalChange: true },
  indicators: [
    { function: 'EMA', priceCols: ['close'], params: { periods: [9, 21] } },
  ],
};

/** 1-minute EMA(9/21) trend/cash strategy. */
export class IntradayEMAScalp1m extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('EMA_9_close');
    const slow = this.data.getFeature('EMA_21_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.34);
  }
}
