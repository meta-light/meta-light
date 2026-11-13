import { type Bar, OrdersStrategy, round2, type StrategyConfig } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'LimitTrendPullback',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2001-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.2,
  indicators: [
    { function: 'SMA', priceCols: ['close'], params: { periods: [50] } },
  ],
  slippage: { type: 'fixed_bps', bps: 3.0 },
  commission: { type: 'fixed_bps', bps: 1.0 },
};

export class LimitTrendPullback extends OrdersStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const sma = this.data.getFeature('SMA_50_close');
    if (!sma.has(date)) return;

    for (const inst of this.instruments) {
      const trend = sma.at(date, inst);
      if (Number.isNaN(trend)) continue;

      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;
      const pending = this.hasPending(inst);

      if (pos === 0 && !pending && bar.close > trend) {
        const shares = Math.trunc((nav * 0.12) / bar.close);
        if (shares > 0) {
          this.submit({
            instrument: inst,
            side: 'buy',
            quantity: shares,
            orderType: 'limit',
            limitPrice: round2(bar.close * 0.99),
            expiresAfterBars: 2,
          });
        }
      } else if (pos > 0 && bar.close < trend) {
        this.cancelAll(inst);
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'market',
        });
      } else if (pos > 0 && !pending) {
        const entry = this.broker.getAverageEntryPrice(inst) || bar.close;
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'limit',
          limitPrice: round2(entry * 1.04),
          expiresAfterBars: 5,
        });
      }
    }
  }
}
