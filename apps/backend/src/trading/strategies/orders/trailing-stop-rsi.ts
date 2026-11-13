import { type Bar, OrdersStrategy, type StrategyConfig } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'TrailingStopRSI',
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
  slippage: { type: 'fixed_bps', bps: 5.0 },
  commission: { type: 'fixed_bps', bps: 1.0 },
};

export class TrailingStopRSI extends OrdersStrategy {
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
    const rsi = this.data.getFeature('RSI_14_close');
    if (!rsi.has(date)) return;

    for (const inst of this.instruments) {
      const value = rsi.at(date, inst);
      if (Number.isNaN(value)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;

      if (pos === 0 && this.hasTrail[inst]) this.hasTrail[inst] = false;

      if (pos === 0 && value < 38 && !this.hasPending(inst)) {
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
          trailPercent: 0.05,
        });
        this.hasTrail[inst] = true;
      } else if (pos > 0 && value > 65) {
        this.cancelAll(inst);
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'market',
        });
        this.hasTrail[inst] = false;
      }
    }
  }
}
