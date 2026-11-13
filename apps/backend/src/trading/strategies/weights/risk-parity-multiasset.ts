// ERC weights are estimated on a strictly prior covariance window (no look-ahead).

import {
  equalWeightActive,
  Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'RiskParityMultiAsset',
  strategyType: 'Long Only',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: 'BME' },
  riskModel: { type: 'risk_parity', lookback: 63 },
  indicators: [],
};

export class RiskParityMultiAsset extends WeightsStrategy {
  static readonly WARMUP = 63;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return Frame.full(close.index, close.columns, 0).map((_, i) =>
      i >= RiskParityMultiAsset.WARMUP ? 1 : 0,
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals);
  }
}
