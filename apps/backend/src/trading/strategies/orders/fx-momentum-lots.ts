// The ContractSpec comes from the data provider: one unit means one
// 100,000-base-currency lot. FX margin, overnight swap/financing, broker
// leverage and bid/ask quotes are not modeled. The universe is limited to
// XXX/USD pairs so PnL is already in the base portfolio currency.

import {
  averageTrueRange,
  type Bar,
  type Frame,
  OrdersStrategy,
  type StrategyConfig,
} from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'FXMomentumLots',
  strategyType: 'Long / Short FX',
  initialCapital: 1_000_000,
  instruments: ['EURUSD=X', 'GBPUSD=X', 'AUDUSD=X', 'NZDUSD=X'],
  backtestPeriod: { start: '2010-01-04', end: '2026-01-01' },
  benchmarkSymbol: 'DX-Y.NYB',
  benchmarkName: 'US Dollar Index',
  source: 'yfinance',
  executionMode: 'orders',
  indicators: [],
  slippage: { type: 'fixed_bps', bps: 0.5 },
  commission: { type: 'fixed_bps', bps: 0.1 },
};

const positiveFinite = (v: number): boolean => Number.isFinite(v) && v > 0;

export function sizeStandardLots({
  nav,
  price,
  atr,
  multiplier,
  lotSize,
  riskFraction = 0.005,
  notionalCap = 0.2,
}: {
  nav: number;
  price: number;
  atr: number;
  multiplier: number;
  lotSize: number;
  riskFraction?: number;
  notionalCap?: number;
}): number {
  if (![nav, price, atr, multiplier, lotSize].every(positiveFinite)) return 0;
  const riskPerLot = atr * multiplier * lotSize;
  const notionalPerLot = price * multiplier * lotSize;
  const byRisk = Math.floor((nav * riskFraction) / riskPerLot);
  const byNotional = Math.floor((nav * notionalCap) / notionalPerLot);
  return Math.max(0, Math.min(byRisk, byNotional));
}

export class FXMomentumLots extends OrdersStrategy {
  static readonly LOOKBACK = 126;
  static readonly ATR_WINDOW = 20;

  private atrCache: Frame | null = null;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const { LOOKBACK, ATR_WINDOW } = FXMomentumLots;
    const close = this.data.getFeature('adj_close');
    const index = close.rowIndex(date);
    if (index < LOOKBACK) return; // also covers a missing date (-1)

    if (this.atrCache?.index !== close.index) {
      const high = this.data.getFeature('high');
      const low = this.data.getFeature('low');
      this.atrCache = averageTrueRange(high, low, close, ATR_WINDOW);
    }
    const atr = this.atrCache;

    for (const instrument of this.instruments) {
      if (this.hasPending(instrument)) continue;
      const current = positions[instrument] ?? 0;
      const currentPrice = bars[instrument]!.close;
      const pastPrice = close.iat(index - LOOKBACK, instrument);
      const currentAtr = atr.at(date, instrument);
      if (Number.isNaN(pastPrice) || pastPrice <= 0 || Number.isNaN(currentAtr))
        continue;

      const direction = currentPrice > pastPrice ? 1 : -1;
      const spec = this.broker.contractSpec(instrument);
      const lots = sizeStandardLots({
        nav,
        price: currentPrice,
        atr: currentAtr,
        multiplier: spec.multiplier,
        lotSize: spec.lotSize ?? NaN,
      });
      const delta = direction * lots - current;
      if (Math.abs(delta) > 1e-12)
        this.orderMarket(instrument, delta, 'fx_momentum_target');
    }
  }
}
