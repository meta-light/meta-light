// Example Orders 14: OCO Dip Or Breakout
//
// Mode: orders. Order type: OCO.
// Idea: submit two competing entry orders: buy a dip or buy a breakout.
// Universe: SPY, QQQ, IWM.
//
// The limit-buy leg sits 2% below the close. The stop-buy leg sits 2% above
// the close. Whichever fills first cancels the other leg.

import {
  type Bar,
  compactDate,
  OrdersStrategy,
  round2,
  type StrategyConfig,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleOrders14_OCODipOrBreakout',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2001-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.2,
  indicators: [],
  slippage: { type: 'fixed_bps', bps: 5.0 },
  commission: { type: 'per_share', costPerShare: 0.005, minPerOrder: 1.0 },
};

/** OCO entry pair: mean-reversion dip versus momentum breakout. */
export class OCODipOrBreakout extends OrdersStrategy {
  private barCount: Record<string, number> = {};
  private entryBar: Record<string, number> = {};
  private ocoLive: Record<string, boolean> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    for (const inst of this.instruments) {
      const count = (this.barCount[inst] = (this.barCount[inst] ?? 0) + 1);
      const bar = bars[inst]!;
      const pos = positions[inst] ?? 0;

      if (pos > 0 && this.ocoLive[inst]) {
        this.ocoLive[inst] = false;
        this.entryBar[inst] = count;
      }

      if (pos === 0) {
        delete this.entryBar[inst];
        if (this.ocoLive[inst] && !this.hasPending(inst))
          this.ocoLive[inst] = false;
      }

      // Time exit after 10 bars in the position.
      if (pos > 0 && count - (this.entryBar[inst] ?? 0) >= 10) {
        this.cancelAll(inst);
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'market',
        });
        delete this.entryBar[inst];
        continue;
      }

      if (pos === 0 && !this.ocoLive[inst]) {
        if (count % 5 !== 0) continue;

        const shares = Math.trunc((nav * 0.1) / bar.close);
        if (shares <= 0) continue;

        const ocoPairId = `${inst}_${compactDate(date)}_dip_or_breakout`;
        this.submit({
          instrument: inst,
          side: 'buy',
          quantity: shares,
          orderType: 'oco',
          limitPrice: round2(bar.close * 0.98),
          ocoPairId,
          expiresAfterBars: 5,
        });
        this.submit({
          instrument: inst,
          side: 'buy',
          quantity: shares,
          orderType: 'oco',
          stopPrice: round2(bar.close * 1.02),
          ocoPairId,
          expiresAfterBars: 5,
        });
        this.ocoLive[inst] = true;
      }
    }
  }
}
