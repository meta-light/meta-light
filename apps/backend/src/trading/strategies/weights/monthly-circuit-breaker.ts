import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'MonthlyCircuitBreaker',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.3,
  rebalancePolicy: {
    frequency: 'BME',
    maxDrawdownTrigger: 0.15,
    maxDrawdownAction: 'flatten',
    circuitBreakerCooldownDays: 10, // wait 10 trading days before re-engaging
  },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [50, 200] } },
  ],
};

export class MonthlyCircuitBreaker extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('SMA_50_close');
    const slow = this.data.getFeature('SMA_200_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.3);
  }
}
