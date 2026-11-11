// Example Orders 07: Stop-Limit Breakout
//
// Mode: orders. Order type: STOP_LIMIT.
// Idea: enter breakouts, but refuse to pay far above the stop trigger.
// Universe: SPY, QQQ, IWM.
//
// The stop activates above the recent 20-day high. The limit caps the maximum
// entry price. This demonstrates fill risk: the order can trigger but not fill.

import { type Bar, isNum, OrdersStrategy, round2, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders07_StopLimitBreakout",
  initialCapital: 100_000,
  instruments: ["SPY", "QQQ", "IWM"],
  backtestPeriod: { start: "2001-01-03", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  maxPositionSize: 0.2,
  indicators: [],
  slippage: { type: "fixed_bps", bps: 4.0 },
  commission: { type: "fixed_bps", bps: 1.0 },
};

/** Max of `xs[start:end]` skipping NaN, or NaN if none are valid. */
function windowMax(xs: number[], start: number, end: number): number {
  const valid = xs.slice(start, end).filter(isNum);
  return valid.length ? Math.max(...valid) : NaN;
}

/** Breakout entries using stop-limit buy orders. */
export class StopLimitBreakout extends OrdersStrategy {
  private barCount: Record<string, number> = {};
  private entryBar: Record<string, number> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(date: string, bars: Record<string, Bar>, positions: Record<string, number>, nav: number): void {
    const close = this.data.getFeature("adj_close");
    const idx = close.rowIndex(date);
    if (idx < 0 || idx < 21) return;

    for (const inst of this.instruments) {
      this.barCount[inst] = (this.barCount[inst] ?? 0) + 1;
      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;

      if (pos > 0 && !(inst in this.entryBar)) this.entryBar[inst] = this.barCount[inst]!;
      if (pos === 0) delete this.entryBar[inst];

      if (pos > 0 && this.barCount[inst]! - (this.entryBar[inst] ?? 0) >= 12) {
        this.cancelAll(inst);
        this.submit({ instrument: inst, side: "sell", quantity: pos, orderType: "market" });
        delete this.entryBar[inst];
        continue;
      }

      if (pos === 0 && !this.hasPending(inst)) {
        const priorHigh = windowMax(close.col(inst), idx - 20, idx);
        if (Number.isNaN(priorHigh)) continue;
        const stopPrice = round2(priorHigh * 1.002);
        const limitPrice = round2(stopPrice * 1.004);
        const shares = Math.trunc((nav * 0.1) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: "buy",
            quantity: shares,
            orderType: "stop_limit",
            stopPrice,
            limitPrice,
            expiresAfterBars: 5,
          });
        }
      }
    }
  }
}
