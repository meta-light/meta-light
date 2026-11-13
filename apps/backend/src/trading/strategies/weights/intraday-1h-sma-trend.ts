// The backtest window is pinned like the original. Swap in `recentPeriod(60)`
// from ../core for a rolling window.

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'IntradaySMATrend1h',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2026-05-11', end: '2026-07-11' },
  granularity: '1h',
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: null, rebalanceOnSignalChange: true },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [10, 30] } },
  ],
};

export class IntradaySMATrend1h extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('SMA_10_close');
    const slow = this.data.getFeature('SMA_30_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
