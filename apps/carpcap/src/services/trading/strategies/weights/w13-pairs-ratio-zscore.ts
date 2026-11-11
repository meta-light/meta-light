// Example Weights 13: Pairs Trading (Ratio Z-Score)
//
// Mode: weights (market-neutral long/short).
// Idea: trade the mean-reverting spread between two closely related names
// using a log-ratio z-score. When the spread stretches, short the rich leg and
// long the cheap leg; unwind when it reverts.
// Universe: KO / PEP consumer-staples pair (pedagogical, not data-mined).
//
// Signal: spread = log(KO) - log(PEP); z-score over a 60-bar window.
//   z > +2      -> short KO, long PEP (KO rich relative to PEP)
//   z < -2      -> long KO, short PEP
//   |z| < 0.5   -> flat
// Weights are +/-0.5 per leg (gross 1.0, net ~0 = dollar-neutral).
//
// Short borrow and financing are not modeled (research approximation).

import { Frame, mean, rolling, type StrategyConfig, std, WeightsStrategy } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleWeights13_PairsRatioZScore",
  strategyType: "Market Neutral",
  initialCapital: 100_000,
  instruments: ["KO", "PEP"],
  backtestPeriod: { start: "2000-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "weights",
  maxPositionSize: 1.0,
  rebalancePolicy: { frequency: "D" },
  indicators: [],
};

/** Market-neutral KO/PEP pair on a log-ratio z-score. */
export class PairsRatioZScore extends WeightsStrategy {
  static readonly LOOKBACK = 60;
  static readonly ENTRY = 2.0;
  static readonly EXIT = 0.5;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const { LOOKBACK, ENTRY, EXIT } = PairsRatioZScore;
    const close = this.data.getFeature("adj_close");
    const [a, b] = [this.instruments[0]!, this.instruments[1]!];
    const ca = close.col(a);
    const cb = close.col(b);
    const spread = ca.map((v, i) => Math.log(v) - Math.log(cb[i]!));
    const mu = rolling(spread, LOOKBACK, mean);
    const sd = rolling(spread, LOOKBACK, std);
    const z = spread.map((s, i) => (s - mu[i]!) / sd[i]!);

    const ia = close.colIndex(a);
    const ib = close.colIndex(b);
    let state = 0; // +1 = long A / short B, -1 = short A / long B
    return Frame.full(close.index, close.columns, 0).mapRows((row, i) => {
      const zi = z[i]!;
      if (Number.isNaN(zi)) state = 0;
      else if (state === 0) {
        if (zi > ENTRY) state = -1;
        else if (zi < -ENTRY) state = 1;
      } else if (Math.abs(zi) < EXIT) state = 0;
      row[ia] = state;
      row[ib] = -state;
      return row;
    });
  }

  computeWeights(): Frame {
    return this.signals.map((v) => v * 0.5);
  }
}
