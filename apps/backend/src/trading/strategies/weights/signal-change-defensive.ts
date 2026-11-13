import {
  equalWeightActive,
  Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'SignalChangeDefensive',
  strategyType: 'Risk On / Risk Off',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.5,
  rebalancePolicy: {
    frequency: null,
    rebalanceOnSignalChange: true,
    signalChangeThreshold: 0.01,
  },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [200] } },
  ],
};

export class SignalChangeDefensiveRotation extends WeightsStrategy {
  static readonly RISK_ON_ASSETS = ['SPY', 'EFA', 'EEM', 'DBC', 'VNQ'];
  static readonly DEFENSIVE_ASSETS = ['TLT', 'IEF', 'GLD'];

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    const sma200 = this.data.getFeature('SMA_200_close');
    return Frame.full(close.index, close.columns, 0).mapRows((row, i) => {
      const date = close.index[i]!;
      const sma = sma200.at(date, 'SPY');
      if (Number.isNaN(sma)) return row;
      const riskOn = close.iat(i, 'SPY') > sma;
      const assets = riskOn
        ? SignalChangeDefensiveRotation.RISK_ON_ASSETS
        : SignalChangeDefensiveRotation.DEFENSIVE_ASSETS;
      return close.columns.map((c) => (assets.includes(c) ? 1 : 0));
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.5);
  }
}
