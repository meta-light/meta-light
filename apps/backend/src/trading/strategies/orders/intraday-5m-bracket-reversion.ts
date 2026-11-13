// The 5m cadence is the sweet spot for intraday mean reversion: long enough
// for RSI to be meaningful, short enough for several round trips per session.
// yfinance serves at most ~60 calendar days of 5-minute bars, so use
// `recentPeriod(30)` from core for a rolling window instead of fixed dates.

import { type Bar, OrdersStrategy, round2, type StrategyConfig } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'IntradayBracketReversion5m',
  strategyType: 'Intraday Mean Reversion',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2026-06-10', end: '2026-07-11' },
  granularity: '5m',
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.25,
  indicators: [
    { function: 'RSI', priceCols: ['close'], params: { periods: [14] } },
  ],
  slippage: { type: 'fixed_bps', bps: 2.0 },
  commission: { type: 'per_share', costPerShare: 0.005, minPerOrder: 1.0 },
};

export class IntradayBracketReversion5m extends OrdersStrategy {
  private hasBracket: Record<string, boolean> = {};

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

      if (pos === 0 && this.hasBracket[inst]) this.hasBracket[inst] = false;

      if (value < 30 && pos === 0 && !this.hasBracket[inst]) {
        const shares = Math.trunc((nav * 0.2) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: 'buy',
            quantity: shares,
            orderType: 'bracket',
            bracket: {
              takeProfitPrice: round2(bar.close * 1.006),
              stopLossPrice: round2(bar.close * 0.996),
            },
          });
          this.hasBracket[inst] = true;
        }
      }
    }
  }
}
