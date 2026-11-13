import { type Frame, type StrategyConfig, WeightsStrategy } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'DailyPartialDrift',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.35,
  rebalancePolicy: {
    frequency: 'D',
    driftThreshold: 0.1, // only act when a weight drifts >10% from target
    driftType: 'absolute',
    partialRebalance: true,
  },
  indicators: [],
};

export class DailyPartialDrift extends WeightsStrategy {
  static readonly LOOKBACK = 63;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  private momentum(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.zip(
      close.shift(DailyPartialDrift.LOOKBACK),
      (c, prev) => c / prev - 1,
    );
  }

  computeSignals(): Frame {
    // NaN momentum -> 0, which `m > 0` already gives.
    return this.momentum().map((m) => (m > 0 ? 1 : 0));
  }

  computeWeights(): Frame {
    const momentum = this.momentum()
      .clip(0)
      .map((m, i, j) => (this.signals.values[i]![j] === 1 ? m : 0));
    return momentum.divRows(momentum.rowSum()).fillNaN(0).clip(-Infinity, 0.35);
  }
}
