// Short borrow/financing is not modeled (research approximation).

import {
  Frame,
  isNum,
  type StrategyConfig,
  topN,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'CrossSectionalMomentum',
  strategyType: 'Market Neutral',
  initialCapital: 100_000,
  instruments: ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: 'BME' },
  indicators: [],
};

export function longShortWeights(signals: Frame): Frame {
  const longs = signals.map((v) => (v === 1 ? 1 : 0));
  const shorts = signals.map((v) => (v === -1 ? 1 : 0));
  const longW = longs.divRows(longs.rowSum()).fillNaN(0);
  const shortW = shorts.divRows(shorts.rowSum()).fillNaN(0);
  return longW.zip(shortW, (l, s) => l * 0.5 - s * 0.5);
}

export class CrossSectionalMomentum extends WeightsStrategy {
  static readonly LOOKBACK = 252;
  static readonly N_SIDE = 3;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, N_SIDE } = CrossSectionalMomentum;
    const close = this.data.getFeature('adj_close');
    const cols = close.columns;
    return Frame.full(close.index, cols, 0).mapRows((row, i) => {
      if (i < LOOKBACK) return row;
      const momentum = close.values[i]!.map(
        (v, j) => v / close.values[i - LOOKBACK]![j]! - 1,
      );
      if (momentum.filter(isNum).length < 2 * N_SIDE) return row;
      const longs = topN(momentum, cols, N_SIDE, 'largest');
      const shorts = topN(momentum, cols, N_SIDE, 'smallest');
      return cols.map((c) =>
        shorts.includes(c) ? -1 : longs.includes(c) ? 1 : 0,
      );
    });
  }

  computeWeights(): Frame {
    return longShortWeights(this.signals);
  }
}
