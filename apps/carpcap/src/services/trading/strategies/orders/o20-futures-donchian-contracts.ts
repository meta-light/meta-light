// Example Orders 20: Futures Donchian Contracts
//
// Mode: orders. Order type: MARKET.
// Idea: a diversified 55-day Donchian breakout across index, energy and metal
// futures. Orders are whole contracts sized by ATR risk, gross notional, and
// the reference initial margin carried in ContractSpec.
// Universe: MES, MNQ, CL and GC provider continuous-futures proxies.
//
// Yahoo `=F` data are provider-managed continuous series. Contract
// multipliers are honored for sizing and PnL, but dated contract selection,
// controlled rolls, tick rounding, variation margin and broker buying power
// are not modeled. Cash accounting uses full notional; the margin figure is
// only an extra sizing cap.

import { averageTrueRange, type Bar, type Frame, OrdersStrategy, type StrategyConfig } from "../core";

export const config: StrategyConfig = {
  strategyName: "ExampleOrders20_FuturesDonchianContracts",
  strategyType: "Long / Short Futures",
  initialCapital: 2_000_000,
  instruments: ["MES=F", "MNQ=F", "CL=F", "GC=F"],
  backtestPeriod: { start: "2019-05-06", end: "2026-01-01" },
  benchmarkSymbol: "SPY",
  benchmarkName: "SPDR S&P 500 ETF Trust",
  source: "yfinance",
  executionMode: "orders",
  indicators: [],
  slippage: { type: "fixed_bps", bps: 1.0 },
  // Quantity-based fee proxy: $2.50 per contract, with no percentage cap.
  commission: { type: "per_share", costPerShare: 2.5, minPerOrder: 2.5, maxPct: 0.0 },
};

const positiveFinite = (v: number): boolean => Number.isFinite(v) && v > 0;

/** Size whole contracts using independent risk and exposure ceilings. */
export function sizeFuturesContracts({
  nav,
  price,
  atr,
  multiplier,
  margin,
  riskFraction = 0.005,
  notionalCap = 0.25,
  marginCap = 0.15,
}: {
  nav: number;
  price: number;
  atr: number;
  multiplier: number;
  margin: number;
  riskFraction?: number;
  notionalCap?: number;
  marginCap?: number;
}): number {
  if (![nav, price, atr, multiplier].every(positiveFinite)) return 0;
  const limits = [
    Math.floor((nav * riskFraction) / (atr * multiplier)),
    Math.floor((nav * notionalCap) / (price * multiplier)),
  ];
  if (positiveFinite(margin)) limits.push(Math.floor((nav * marginCap) / margin));
  return Math.max(0, Math.min(...limits));
}

/** Highest (or lowest) non-NaN value in `xs[from, to)`, NaN if none. */
function windowExtreme(xs: readonly number[], from: number, to: number, pick: "max" | "min"): number {
  const win = xs.slice(from, to).filter((v) => !Number.isNaN(v));
  if (!win.length) return NaN;
  return pick === "max" ? Math.max(...win) : Math.min(...win);
}

/** Donchian breakout using provider continuous-futures specs. */
export class FuturesDonchianContracts extends OrdersStrategy {
  static readonly BREAKOUT_WINDOW = 55;
  static readonly ATR_WINDOW = 20;

  private atrCache: Frame | null = null;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(date: string, bars: Record<string, Bar>, positions: Record<string, number>, nav: number): void {
    const { BREAKOUT_WINDOW, ATR_WINDOW } = FuturesDonchianContracts;
    const close = this.data.getFeature("adj_close");
    const index = close.rowIndex(date);
    if (index < BREAKOUT_WINDOW) return; // also covers a missing date (-1)

    const high = this.data.getFeature("high");
    const low = this.data.getFeature("low");
    if (this.atrCache?.index !== close.index) {
      this.atrCache = averageTrueRange(high, low, close, ATR_WINDOW);
    }
    const atr = this.atrCache;

    for (const instrument of this.instruments) {
      if (this.hasPending(instrument)) continue;
      const current = positions[instrument] ?? 0;
      const currentPrice = bars[instrument]!.close;
      const priorHigh = windowExtreme(high.col(instrument), index - BREAKOUT_WINDOW, index, "max");
      const priorLow = windowExtreme(low.col(instrument), index - BREAKOUT_WINDOW, index, "min");
      const currentAtr = atr.at(date, instrument);
      if (Number.isNaN(priorHigh) || Number.isNaN(priorLow) || Number.isNaN(currentAtr)) continue;

      let direction: number;
      if (currentPrice > priorHigh) direction = 1;
      else if (currentPrice < priorLow) direction = -1;
      else direction = Math.sign(current);

      const spec = this.broker.contractSpec(instrument);
      const contracts = sizeFuturesContracts({
        nav,
        price: currentPrice,
        atr: currentAtr,
        multiplier: spec.multiplier,
        margin: spec.margin ?? NaN,
      });
      const delta = direction * contracts - current;
      if (Math.abs(delta) > 1e-12) this.orderMarket(instrument, delta, "futures_donchian_target");
    }
  }
}
