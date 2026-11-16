import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'IntradayEMAScalp1m',
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
