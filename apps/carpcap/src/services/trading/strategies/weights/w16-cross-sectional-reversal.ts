// Example Weights 16: Cross-Sectional Short-Term Reversal (Long/Short)
//
// Mode: weights (dollar-neutral long/short).
// Idea: the mirror image of momentum. Over short horizons, recent losers tend
// to bounce and recent winners tend to give back. Each week, rank the universe
// by 1-month return, LONG the biggest losers and SHORT the biggest winners.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// Signal: 21-bar (~1-month) return per name; long bottom 3, short top 3.
// Weights: +0.5 spread across longs, -0.5 across shorts (gross 1.0, net ~0).
//
// Short borrow/financing is not modeled (research approximation). Short-term
// reversal is turnover-heavy, so enable slippage/commissions before drawing
// conclusions.

import { Frame, isNum, type StrategyConfig, topN, WeightsStrategy } from "../core";
import { longShortWeights } from "./w15-cross-sectional-momentum";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights16_CrossSectionalReversal",
  strategyType: "Market Neutral",
  initialCapital: 100_000,
  instruments: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"],
  backtestPeriod: { start: "2000-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: "W", weekday: 4 },
  indicators: [],
};

/** Dollar-neutral 1-month cross-sectional reversal. */
export class CrossSectionalReversal extends WeightsStrategy {
  static readonly LOOKBACK = 21;
  static readonly N_SIDE = 3;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, N_SIDE } = CrossSectionalReversal;
    const close = this.data.getFeature("adj_close");
    const cols = close.columns;
    return Frame.full(close.index, cols, 0).mapRows((row, i) => {
      if (i < LOOKBACK) return row;
      const ret = close.values[i]!.map((v, j) => v / close.values[i - LOOKBACK]![j]! - 1);
      if (ret.filter(isNum).length < 2 * N_SIDE) return row;
      const longs = topN(ret, cols, N_SIDE, "smallest"); // buy the losers
      const shorts = topN(ret, cols, N_SIDE, "largest"); // short the winners
      return cols.map((c) => (shorts.includes(c) ? -1 : longs.includes(c) ? 1 : 0));
    });
  }

  computeWeights(): Frame {
    return longShortWeights(this.signals);
  }
}
