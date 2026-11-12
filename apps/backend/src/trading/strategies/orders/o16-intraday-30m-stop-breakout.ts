// Example Orders 16: Intraday 30m Stop Breakout
//
// Mode: orders. Order type: STOP.
// Idea: on 30-minute bars, place buy-stop orders above the recent 12-bar high
// so entries only trigger on confirmed intraday breakouts. Positions are held
// for a fixed number of bars and then exited at market.
// Universe: SPY, QQQ, IWM.
//
// At 30m the session has ~13 bars, so a 12-bar high is roughly a prior-session
// breakout. A gap through the stop fills at the worse open, not the stop price.
// yfinance serves at most ~60 calendar days of 30-minute bars, so use
// `recentPeriod(55)` from core for a rolling window instead of fixed dates.

import {
  type Bar,
  isNum,
  OrdersStrategy,
  round2,
  type StrategyConfig,
} from '../../../services/trading/strategies/core';

export const config: StrategyConfig = {
  strategyName: 'ExampleOrders16_IntradayStopBreakout30m',
  strategyType: 'Intraday Breakout',
  initialCapital: 100_000,
  instruments: ['SPY', 'QQQ', 'IWM'],
  backtestPeriod: { start: '2026-05-16', end: '2026-07-11' },
  granularity: '30m',
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.25,
  indicators: [],
  slippage: { type: 'fixed_bps', bps: 2.0 },
  commission: { type: 'per_share', costPerShare: 0.005, minPerOrder: 1.0 },
};

/** 30-minute breakout via buy-stop, fixed holding period. */
export class IntradayStopBreakout30m extends OrdersStrategy {
  static readonly LOOKBACK = 12;
  static readonly HOLD_BARS = 8;

  private barCount: Record<string, number> = {};
  private entryBar: Record<string, number> = {};

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const { LOOKBACK, HOLD_BARS } = IntradayStopBreakout30m;
    if (Number.isNaN(nav) || nav <= 0) return;

    const high = this.data.getFeature('high');
    const posIdx = high.rowIndex(date);
    if (posIdx < 0 || posIdx < LOOKBACK) return;

    for (const inst of this.instruments) {
      this.barCount[inst] = (this.barCount[inst] ?? 0) + 1;
      const close = bars[inst]!.close;
      if (Number.isNaN(close) || close <= 0) continue;

      const pos = positions[inst] ?? 0;

      // Time-based exit.
      if (pos > 0) {
        const held = this.barCount[inst]! - (this.entryBar[inst] ?? 0);
        if (held >= HOLD_BARS) {
          this.cancelAll(inst);
          this.submit({
            instrument: inst,
            side: 'sell',
            quantity: pos,
            orderType: 'market',
          });
          delete this.entryBar[inst];
        }
        continue;
      }

      // pandas .max() skips NaN and gives NaN for an all-NaN window.
      const window = high
        .col(inst)
        .slice(posIdx - LOOKBACK, posIdx)
        .filter(isNum);
      const priorHigh = window.length ? Math.max(...window) : NaN;
      if (Number.isNaN(priorHigh) || priorHigh <= 0) continue;

      const shares = Math.trunc((nav * 0.2) / close);
      if (shares > 0) {
        this.submit({
          instrument: inst,
          side: 'buy',
          quantity: shares,
          orderType: 'stop',
          stopPrice: round2(priorHigh * 1.001),
          expiresAfterBars: 3,
        });
        this.entryBar[inst] = this.barCount[inst]!;
      }
    }
  }
}
