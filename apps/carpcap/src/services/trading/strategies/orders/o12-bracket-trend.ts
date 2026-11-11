// Example Orders 12: Bracket Trend
//
// Mode: orders. Order type: BRACKET.
// Idea: enter on SMA trend and attach take-profit plus stop-loss exits.
// Universe: SPY, QQQ, IWM.
//
// The bracket parent enters at market. The engine then activates a limit
// take-profit and a stop-loss as an OCO pair.

import { type Bar, OrdersStrategy, round2, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders12_BracketTrend",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2001-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  maxPositionSize: 0.25,
  indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [20, 50] } }],
  slippage: { type: "fixed_bps", bps: 5.0 },
  commission: { type: "per_share", costPerShare: 0.005, minPerOrder: 1.0 },
};

/** SMA trend entry with a +6% take-profit and -3% stop-loss bracket. */
export class BracketTrend extends OrdersStrategy {
  private prevSignal: Record<string, number> = {};
  private hasBracket: Record<string, boolean> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(date: string, bars: Record<string, Bar>, positions: Record<string, number>, nav: number): void {
    const smaFast = this.data.getFeature("SMA_20_close");
    const smaSlow = this.data.getFeature("SMA_50_close");
    if (!smaFast.has(date)) return;

    for (const inst of this.instruments) {
      const fast = smaFast.at(date, inst);
      const slow = smaSlow.at(date, inst);
      if (Number.isNaN(fast) || Number.isNaN(slow)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;
      const signal = fast > slow ? 1 : 0;
      const prev = this.prevSignal[inst] ?? 0;

      if (pos === 0 && this.hasBracket[inst]) this.hasBracket[inst] = false;

      if (signal === 1 && prev === 0 && pos === 0) {
        const shares = Math.trunc((nav * 0.15) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: "buy",
            quantity: shares,
            orderType: "bracket",
            bracket: {
              takeProfitPrice: round2(bar.close * 1.06),
              stopLossPrice: round2(bar.close * 0.97),
            },
          });
          this.hasBracket[inst] = true;
        }
      } else if (signal === 0 && prev === 1 && pos > 0) {
        this.cancelAll(inst);
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
        this.hasBracket[inst] = false;
      }

      this.prevSignal[inst] = signal;
    }
  }
}
