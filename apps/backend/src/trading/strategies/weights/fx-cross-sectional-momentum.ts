// This intentionally uses only XXX/USD pairs so every price move has the same
// directional interpretation. It does not include forward carry, swaps, FX
// margin, or executable bid/ask quotes.

import {
  Frame,
  isNum,
  type StrategyConfig,
  topN,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'FXCrossSectionalMomentum',
  strategyType: 'Market Neutral FX Proxy',
  initialCapital: 500_000,
  instruments: ['EURUSD=X', 'GBPUSD=X', 'AUDUSD=X', 'NZDUSD=X'],
  backtestPeriod: { start: '2010-01-04', end: '2026-01-01' },
  benchmarkSymbol: 'DX-Y.NYB',
  benchmarkName: 'US Dollar Index',
  source: 'yfinance',
  executionMode: 'weights',
  rebalancePolicy: { frequency: 'BME' },
  indicators: [],
};

export function buildFxCrossSectionalMomentum(
  close: Frame,
  { lookback = 63, namesPerSide = 1 } = {},
): { signals: Frame; weights: Frame } {
  const scores = close.pctChange(lookback);
  const cols = close.columns;
  const signals = Frame.full(close.index, cols, 0).mapRows((row, i) => {
    const score = scores.values[i]!;
    if (score.filter(isNum).length < 2 * namesPerSide) return row;
    const longs = topN(score, cols, namesPerSide, 'largest');
    const shorts = topN(score, cols, namesPerSide, 'smallest');
    return cols.map((c) =>
      shorts.includes(c) ? -1 : longs.includes(c) ? 1 : 0,
    );
  });
  const longMask = signals.map((v) => (v > 0 ? 1 : 0));
  const shortMask = signals.map((v) => (v < 0 ? 1 : 0));
  const longW = longMask.divRows(longMask.rowSum()).fillNaN(0);
  const shortW = shortMask.divRows(shortMask.rowSum()).fillNaN(0);
  return { signals, weights: longW.zip(shortW, (l, s) => l * 0.5 - s * 0.5) };
}

export class FXCrossSectionalMomentum extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    return buildFxCrossSectionalMomentum(this.data.getFeature('adj_close'))
      .signals;
  }

  computeWeights(): Frame {
    return buildFxCrossSectionalMomentum(this.data.getFeature('adj_close'))
      .weights;
  }
}
