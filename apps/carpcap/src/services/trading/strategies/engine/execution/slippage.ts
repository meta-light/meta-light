// Slippage models: pluggable fill-price adjustments. Buys pay up, sells
// receive less.
//
// Ported from backtester/execution/slippage.py (QuantJourney Backtester, Apache 2.0)

import type { SlippageModel as SlippageConfig } from "../../core";
import type { BarData, OrderSide } from "./order-types";

export interface Slippage {
  compute(price: number, quantity: number, side: OrderSide, bar: BarData): number;
}

const adjust = (price: number, spread: number, side: OrderSide): number =>
  side === "buy" ? price + spread : price - spread;

export class NoSlippage implements Slippage {
  compute(price: number): number {
    return price;
  }
}

/** Constant half-spread in basis points. */
export class FixedBpsSlippage implements Slippage {
  constructor(readonly bps = 5.0) {}

  compute(price: number, _quantity: number, side: OrderSide): number {
    return adjust(price, (Math.abs(price) * this.bps) / 10_000, side);
  }
}

/**
 * Spread proportional to the bar's (high - low) / close. The fill engine
 * passes the previous completed bar for opening fills.
 */
export class VolatilitySlippage implements Slippage {
  constructor(readonly volFactor = 0.1) {}

  compute(price: number, _quantity: number, side: OrderSide, bar: BarData): number {
    if (bar.close === 0) return price;
    const range = Math.abs(bar.high - bar.low) / Math.abs(bar.close);
    return adjust(price, Math.abs(price) * this.volFactor * range, side);
  }
}

/** Almgren-style impact: price * eta * sigma * sqrt(quantity / ADV). */
export class MarketImpactSlippage implements Slippage {
  constructor(
    readonly sigmaDaily = 0.02,
    readonly adv = 1_000_000,
    readonly eta = 0.1,
  ) {}

  compute(price: number, quantity: number, side: OrderSide): number {
    const participation = Math.abs(quantity) / Math.max(this.adv, 1);
    return adjust(price, Math.abs(price) * this.eta * this.sigmaDaily * Math.sqrt(participation), side);
  }
}

/** Build a model from a strategy config's `slippage` field. Not in the Python module. */
export function slippageFromConfig(cfg: SlippageConfig | undefined): Slippage {
  if (!cfg) return new NoSlippage();
  return new FixedBpsSlippage(cfg.bps);
}
