// Example Orders 01: Market SMA Crossover
//
// Mode: orders. Order type: MARKET.
// Idea: buy on SMA(20) crossing above SMA(50), sell on the reverse cross.
// Universe: SPY, QQQ, IWM.
//
// The simplest order-mode template: the strategy submits explicit market
// orders, and the engine handles fills, slippage and commissions.

import { type Bar, OrdersStrategy, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders01_MarketSMACross",
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

/** SMA(20/50) crossover implemented with market orders. */
export class MarketSMACrossover extends OrdersStrategy {
  private prevSignal: Record<string, number> = {};

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

      if (signal === 1 && prev === 0 && pos === 0 && !this.hasPending(inst)) {
        const shares = Math.trunc((nav * 0.18) / bar.close);
        if (shares > 0) this.submit({ instrument: inst, side: "buy", quantity: shares, orderType: "market" });
      } else if (signal === 0 && prev === 1 && pos > 0) {
        this.cancelAll(inst);
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
      }

      this.prevSignal[inst] = signal;
    }
  }
}
