// The backtest window is pinned like the original. Swap in `recentPeriod(21)`
// from ../core for a rolling window (yfinance only serves recent intraday bars).

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'IntradayRSI15m',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2026-06-19', end: '2026-07-11' },
  granularity: '15m',
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: null, rebalanceOnSignalChange: true },
  indicators: [
    { function: 'RSI', priceCols: ['close'], params: { periods: [14] } },
  ],
};

export class IntradayRSI15m extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const rsi = this.data.getFeature('RSI_14_close');
    const inPosition = rsi.columns.map(() => false);
    return rsi.mapRows((row) =>
      row.map((value, j) => {
        if (Number.isNaN(value)) inPosition[j] = false;
        else if (!inPosition[j] && value < 35) inPosition[j] = true;
        else if (inPosition[j] && value > 55) inPosition[j] = false;
        return inPosition[j] ? 1 : 0;
      }),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
