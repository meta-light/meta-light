// Example Orders 02: Market RSI Mean Reversion
//
// Mode: orders. Order type: MARKET.
// Idea: buy oversold liquid ETFs when RSI(14) is below 35, sell when RSI is above 60.
// Universe: SPY, QQQ, IWM.
//
// Market orders for both entry and exit, so it is easy to read and useful as
// a minimal order-mode mean-reversion template.

import { type Bar, OrdersStrategy, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders02_MarketRSIReversion",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2001-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  maxPositionSize: 0.2,
  indicators: [{ function: "RSI", priceCols: ["close"], params: { periods: [14] } }],
  slippage: { type: "fixed_bps", bps: 5.0 },
  commission: { type: "fixed_bps", bps: 1.0 },
};

/** RSI entry/exit strategy implemented with market orders. */
export class MarketRSIReversion extends OrdersStrategy {
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
        const shares = Math.trunc((nav * 0.12) / bar.close);
        if (shares > 0) this.submit({ instrument: inst, side: "buy", quantity: shares, orderType: "market" });
      } else if (pos > 0 && value > 60) {
        this.cancelAll(inst);
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
      }
    }
  }
}
