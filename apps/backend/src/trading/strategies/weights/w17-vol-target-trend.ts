// Example Weights 17: Volatility-Targeted Trend
//
// Mode: weights + risk overlay.
// Idea: a simple SMA(50/200) trend basket, but instead of holding fixed
// weights, scale total exposure so the portfolio targets ~10% annualized
// volatility. In calm markets the strategy leans in; in turbulent markets it
// de-risks.
// Universe: multi-asset ETFs SPY, EFA, EEM, TLT, IEF, GLD, DBC, VNQ.
//
// Risk overlay: vol target 10%, 63-bar lookback, max leverage 1.5, applied by
// the engine between weights and rebalance. Volatility is estimated on a
// strictly prior window (no look-ahead).

import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights17_VolTargetTrend',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.34,
  rebalancePolicy: { frequency: 'BME' },
  riskModel: {
    type: 'vol_target',
    targetVol: 0.1,
    lookback: 63,
    maxLeverage: 1.5,
  },
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [50, 200] } },
  ],
};

/** SMA(50/200) trend basket scaled to a volatility target. */
export class VolTargetTrend extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const fast = this.data.getFeature('SMA_50_close');
    const slow = this.data.getFeature('SMA_200_close');
    return crossAbove(fast, slow);
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.34);
  }
}
