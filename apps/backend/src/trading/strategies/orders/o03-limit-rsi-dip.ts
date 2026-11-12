// Example Orders 03: Limit RSI Dip Buyer
//
// Mode: orders. Order type: LIMIT.
// Idea: when RSI is weak, place a passive buy limit below the close.
// Universe: SPY, QQQ, IWM.
//
// Entries are limit buys 1.5% below the signal close. Exits are limit sells
// 3% above average entry. Each order expires after three bars.

import { type Bar, OrdersStrategy, round2, type StrategyConfig } from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleOrders03_LimitRSIDip',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2001-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.25,
  indicators: [
    { function: 'RSI', priceCols: ['close'], params: { periods: [14] } },
  ],
  slippage: { type: 'fixed_bps', bps: 3.0 },
  commission: { type: 'fixed_bps', bps: 1.0 },
};

/** Passive RSI dip buyer using limit orders for entry and profit-taking. */
export class LimitRSIDipBuyer extends OrdersStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const rsi = this.data.getFeature('RSI_14_close');
    if (!rsi.has(date)) return;

    for (const inst of this.instruments) {
      const value = rsi.at(date, inst);
      if (Number.isNaN(value)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;
      const pending = this.hasPending(inst);

      if (pos === 0 && !pending && value < 40) {
        const shares = Math.trunc((nav * 0.15) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: 'buy',
            quantity: shares,
            orderType: 'limit',
            limitPrice: round2(bar.close * 0.985),
            expiresAfterBars: 3,
          });
        }
      } else if (pos > 0 && !pending) {
        const entry = this.broker.getAverageEntryPrice(inst) || bar.close;
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'limit',
          limitPrice: round2(entry * 1.03),
          expiresAfterBars: 3,
        });
      }
    }
  }
}
