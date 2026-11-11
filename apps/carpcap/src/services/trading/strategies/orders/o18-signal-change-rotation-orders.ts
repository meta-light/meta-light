// Example Orders 18: Signal-Change Event-Driven Rotation
//
// Mode: orders. Order type: MARKET.
// Idea: no calendar at all. Each name has an SMA trend signal; the strategy
// trades only when a signal flips: buy on flat->long, sell on long->flat.
// Universe: SPY, QQQ, IWM.
//
// The order-mode counterpart to the weights "signal-change" policy. Turnover
// is driven purely by how often trends change, the lowest-churn way to run a
// trend strategy.

import { type Bar, OrdersStrategy, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders18_SignalChangeRotationOrders",
  strategyType: "Long / Cash",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2001-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  maxPositionSize: 0.2,
  indicators: [{ function: "SMA", priceCols: ["close"], params: { periods: [20, 50] } }],
  slippage: { type: "fixed_bps", bps: 3.0 },
  commission: { type: "per_share", costPerShare: 0.005, minPerOrder: 1.0 },
};

/** Trade only on SMA trend-signal flips, in order mode. */
export class SignalChangeRotationOrders extends OrdersStrategy {
  private prevSignal: Record<string, number> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(date: string, bars: Record<string, Bar>, positions: Record<string, number>, nav: number): void {
    const fast = this.data.getFeature("SMA_20_close");
    const slow = this.data.getFeature("SMA_50_close");
    if (!fast.has(date)) return;

    for (const inst of this.instruments) {
      const f = fast.at(date, inst);
      const s = slow.at(date, inst);
      if (Number.isNaN(f) || Number.isNaN(s)) continue;

      const signal = f > s ? 1 : 0;
      const prev = this.prevSignal[inst] ?? 0;
      const pos = positions[inst] ?? 0;

      if (signal === 1 && prev === 0 && pos === 0) {
        // Event: flat -> long flip.
        const shares = Math.trunc((nav * 0.18) / bars[inst]!.close);
        if (shares > 0) this.submit({ instrument: inst, side: "buy", quantity: shares, orderType: "market" });
      } else if (signal === 0 && prev === 1 && pos > 0) {
        // Event: long -> flat flip.
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
      }

      this.prevSignal[inst] = signal;
    }
  }
}
