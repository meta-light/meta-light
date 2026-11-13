import { Frame, type StrategyConfig, WeightsStrategy } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'MonthlyInverseVol',
  strategyType: 'Long Only',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.35,
  rebalancePolicy: { frequency: 'BME' },
  indicators: [],
};

export class MonthlyInverseVol extends WeightsStrategy {
  static readonly LOOKBACK = 63;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return Frame.full(close.index, close.columns, 0).map((_, i) =>
      i >= MonthlyInverseVol.LOOKBACK ? 1 : 0,
    );
  }

  computeWeights(): Frame {
    const close = this.data.getFeature('adj_close');
    const realizedVol = close
      .pctChange()
      .rollingStd(MonthlyInverseVol.LOOKBACK)
      .map((v) => v * Math.sqrt(252));
    const inverseVol = realizedVol.map((v) => (v === 0 ? NaN : 1 / v));
    return inverseVol
      .divRows(inverseVol.rowSum())
      .fillNaN(0)
      .clip(-Infinity, 0.35);
  }
}
