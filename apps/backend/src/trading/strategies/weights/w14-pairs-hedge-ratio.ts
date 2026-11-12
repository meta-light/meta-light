// Example Weights 14: Pairs Trading (Rolling Hedge Ratio)
//
// Mode: weights (market-neutral long/short).
// Idea: same mean-reversion premise as the ratio pair, but the spread is built
// from a rolling OLS hedge ratio (beta of A on B) instead of a 1:1 log ratio,
// so the pair stays balanced as the relationship drifts.
// Universe: predeclared EWA / EWC country-ETF pair (pedagogical, not data-mined).
//
// Signal: beta = rollingCov(logA, logB) / rollingVar(logB);
// spread = logA - beta * logB; z-score over a 60-bar window.
// - z > +2    -> short EWA, long EWC
// - z < -2    -> long EWA, short EWC
// - |z| < 0.5 -> flat
// Weights are +/-0.5 per leg (dollar-neutral); the hedge ratio drives the signal.
//
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
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights14_PairsHedgeRatio',
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

/** Market-neutral EWA/EWC pair on a rolling hedge-ratio spread. */
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
