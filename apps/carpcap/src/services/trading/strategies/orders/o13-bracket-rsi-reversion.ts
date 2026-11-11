// Example Orders 13: Bracket RSI Reversion
//
// Mode: orders. Order type: BRACKET.
// Idea: buy oversold RSI dips with a predefined reward/risk bracket.
// Universe: SPY, QQQ, IWM.
//
// Each RSI entry uses a bracket with +4% take-profit and -2% stop-loss. This is
// a compact way to express a complete trade lifecycle in one order.

import { type Bar, OrdersStrategy, round2, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders13_BracketRSIReversion",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2001-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  maxPositionSize: 0.25,
  indicators: [{ function: "RSI", priceCols: ["close"], params: { periods: [14] } }],
  slippage: { type: "fixed_bps", bps: 5.0 },
  commission: { type: "fixed_bps", bps: 1.0 },
};

/** RSI dip-buying with bracket exits. */
export class BracketRSIReversion extends OrdersStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(date: string, bars: Record<string, Bar>, positions: Record<string, number>, nav: number): void {
    const rsi = this.data.getFeature("RSI_14_close");
    if (!rsi.has(date)) return;

    for (const inst of this.instruments) {
      const value = rsi.at(date, inst);
      if (Number.isNaN(value)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;

      if (pos === 0 && value < 35 && !this.hasPending(inst)) {
        const shares = Math.trunc((nav * 0.15) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: "buy",
            quantity: shares,
            orderType: "bracket",
            bracket: {
              takeProfitPrice: round2(bar.close * 1.04),
              stopLossPrice: round2(bar.close * 0.98),
            },
          });
        }
      } else if (pos > 0 && value > 70) {
        this.cancelAll(inst);
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
      }
    }
  }
}
