// Volatility is estimated on a strictly prior window (no look-ahead).

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'VolTargetTrend',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.34,
  rebalancePolicy: { frequency: 'BME' },
  riskModel: {
    type: 'vol_target',
    targetVol: 0.1,
    lookback: 63,
    maxLeverage: 1.5,
  },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [50, 200] } },
  ],
};

export class VolTargetTrend extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('SMA_50_close');
    const slow = this.data.getFeature('SMA_200_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.34);
  }
}
