// Example Weights 21: Bollinger Band Mean Reversion
//
// Mode: weights.
// Idea: buy a name when its price closes below the lower Bollinger Band (a
// stretched-cheap signal) and hold until it reverts back above the
// moving-average midline. A classic band-based mean-reversion template.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Signal: mid = SMA(20), band = mid +/- 2 * rolling std(20).
// - close < lower band -> enter long
// - close > mid        -> exit
// Bands are computed inline from adjusted close.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights21_BollingerReversion',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY'],
  backtestPeriod: { start: '2000-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  maxPositionSize: 0.25,
  rebalancePolicy: { frequency: 'D' },
  indicators: [],
};

/** Long when price closes below the lower band, exit at the midline. */
export class BollingerReversion extends WeightsStrategy {
  static readonly WINDOW = 20;
  static readonly N_STD = 2.0;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { WINDOW, N_STD } = BollingerReversion;
    const close = this.data.getFeature('adj_close');
    const mid = close.rollingMean(WINDOW);
    const lower = mid.zip(close.rollingStd(WINDOW), (m, s) => m - N_STD * s);
    return close.mapCols((col, inst) => {
      const lo = lower.col(inst);
      const mi = mid.col(inst);
      let holding = false;
      return col.map((c, t) => {
        if (Number.isNaN(lo[t]!) || Number.isNaN(mi[t]!)) holding = false;
        else if (!holding && c < lo[t]!) holding = true;
        else if (holding && c > mi[t]!) holding = false;
        return holding ? 1 : 0;
      });
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
