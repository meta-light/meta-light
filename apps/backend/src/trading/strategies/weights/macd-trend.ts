import {
  equalWeightActive,
  type Frame,
  isNum,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'MACDTrend',
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
  indicators: [],
};

export class MACDTrend extends WeightsStrategy {
  static readonly FAST = 12;
  static readonly SLOW = 26;
  static readonly SIGNAL = 9;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { FAST, SLOW, SIGNAL } = MACDTrend;
    const close = this.data.getFeature('adj_close');
    const emaFast = close.ewmMean(FAST, false);
    const emaSlow = close.ewmMean(SLOW, false);
    const macd = emaFast.zip(emaSlow, (f, s) => f - s);
    const signalLine = macd.ewmMean(SIGNAL, false);
    return macd.zip(signalLine, (m, s, i, j) =>
      isNum(close.values[i]![j]!) && m > s ? 1 : 0,
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
