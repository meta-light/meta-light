// Example Weights 15: Cross-Sectional Momentum (Long/Short)
//
// Mode: weights (dollar-neutral long/short).
// Idea: each month, rank the universe by 12-month price momentum, go long the
// top names and short the bottom names in equal dollar amounts. The classic
// cross-sectional momentum factor.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Signal: 12-month (252-bar) return per name; long top 3, short bottom 3.
// Weights: +0.5 spread across longs, -0.5 across shorts (gross 1.0, net ~0).
//
// Short borrow/financing is not modeled (research approximation).

import {
  Frame,
  isNum,
  type StrategyConfig,
  topN,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights15_CrossSectionalMomentum',
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

/** +0.5 split across the +1 names, -0.5 across the -1 names, per row. */
export function longShortWeights(signals: Frame): Frame {
  const longs = signals.map((v) => (v === 1 ? 1 : 0));
  const shorts = signals.map((v) => (v === -1 ? 1 : 0));
  const longW = longs.divRows(longs.rowSum()).fillNaN(0);
  const shortW = shorts.divRows(shorts.rowSum()).fillNaN(0);
  return longW.zip(shortW, (l, s) => l * 0.5 - s * 0.5);
}

/** Dollar-neutral 12-month cross-sectional momentum. */
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
