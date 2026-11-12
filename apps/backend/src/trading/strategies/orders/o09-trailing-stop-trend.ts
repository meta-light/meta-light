// Example Orders 09: Trailing Stop Trend
//
// Mode: orders. Order types: MARKET entry, STOP_TRAIL exit.
// Idea: enter on SMA trend and let a 4% trailing stop manage the exit.
// Universe: SPY, QQQ, IWM.
//
// The stop ratchets upward as price makes new highs. It does not need manual
// updates from the strategy; the engine manages the trailing anchor.

import { type Bar, OrdersStrategy, type StrategyConfig } from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleOrders09_TrailingStopTrend',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2001-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.25,
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [20, 50] } },
  ],
  slippage: { type: 'fixed_bps', bps: 5.0 },
  commission: { type: 'per_share', costPerShare: 0.005, minPerOrder: 1.0 },
};

/** SMA trend entry with a trailing stop exit. */
export class TrailingStopTrend extends OrdersStrategy {
  private prevSignal: Record<string, number> = {};
  private hasTrail: Record<string, boolean> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const smaFast = this.data.getFeature('SMA_20_close');
    const smaSlow = this.data.getFeature('SMA_50_close');
    if (!smaFast.has(date)) return;

    for (const inst of this.instruments) {
      const fast = smaFast.at(date, inst);
      const slow = smaSlow.at(date, inst);
      if (Number.isNaN(fast) || Number.isNaN(slow)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;
      const signal = fast > slow ? 1 : 0;
      const prev = this.prevSignal[inst] ?? 0;

      if (pos === 0 && this.hasTrail[inst]) this.hasTrail[inst] = false;

      if (signal === 1 && prev === 0 && pos === 0) {
        const shares = Math.trunc((nav * 0.15) / bar.close);
        if (shares > 0)
          this.submit({
            instrument: inst,
            side: 'buy',
            quantity: shares,
            orderType: 'market',
          });
      } else if (pos > 0 && !this.hasTrail[inst]) {
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'stop_trail',
          trailPercent: 0.04,
        });
        this.hasTrail[inst] = true;
      } else if (signal === 0 && prev === 1 && pos > 0) {
        this.cancelAll(inst);
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'market',
        });
        this.hasTrail[inst] = false;
      }

      this.prevSignal[inst] = signal;
    }
  }
}
