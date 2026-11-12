// Example Weights 03: Weekly RSI Mean Reversion
//
// Mode: weights.
// Idea: enter when RSI(14) is below 35, stay long until RSI rises above 60.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Uses a small state machine inside computeSignals instead of a one-bar
// condition, so entries and exits can have different thresholds.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights03_WeeklyRSIReversion',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: 'W', weekday: 4 },
  indicators: [
    { function: 'RSI', priceCols: ['close'], params: { periods: [14] } },
  ],
};

/** RSI mean-reversion strategy with weekly execution. */
export class WeeklyRSIReversion extends WeightsStrategy {
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
        else if (inPosition[j] && value > 60) inPosition[j] = false;
        return inPosition[j] ? 1 : 0;
      }),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
