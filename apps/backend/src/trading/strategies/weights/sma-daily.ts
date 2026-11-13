import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'DailySMATrend',
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
