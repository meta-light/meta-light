// Short borrow/financing is not modeled (research approximation).

import {
  Frame,
  mean,
  rolling,
  rollingCov,
  std,
  type StrategyConfig,
  variance,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'PairsHedgeRatio',
  strategyType: 'Market Neutral',
  initialCapital: 100_000,
  instruments: ['EWA', 'EWC'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: 'D' },
  indicators: [],
};

export class PairsHedgeRatio extends WeightsStrategy {
  static readonly LOOKBACK = 60;
  static readonly ENTRY = 2.0;
  static readonly EXIT = 0.5;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, ENTRY, EXIT } = PairsHedgeRatio;
    const close = this.data.getFeature('adj_close');
    const [a, b] = [this.instruments[0]!, this.instruments[1]!];
    const la = close.col(a).map(Math.log);
    const lb = close.col(b).map(Math.log);
    const cov = rollingCov(la, lb, LOOKBACK);
    const varB = rolling(lb, LOOKBACK, variance);
    const spread = la.map((x, i) => x - (cov[i]! / varB[i]!) * lb[i]!);
    const spreadMean = rolling(spread, LOOKBACK, mean);
    const spreadStd = rolling(spread, LOOKBACK, std);
    const z = spread.map((s, i) => (s - spreadMean[i]!) / spreadStd[i]!);

    const signals = Frame.full(close.index, close.columns, 0);
    const ia = signals.colIndex(a);
    const ib = signals.colIndex(b);
    let state = 0;
    z.forEach((zi, i) => {
      if (Number.isNaN(zi)) state = 0;
      else if (state === 0) {
        if (zi > ENTRY) state = -1;
        else if (zi < -ENTRY) state = 1;
      } else if (Math.abs(zi) < EXIT) state = 0;
      signals.values[i]![ia] = state;
      signals.values[i]![ib] = -state;
    });
    return signals;
  }

  computeWeights(): Frame {
    return this.signals.map((v) => v * 0.5);
  }
}
