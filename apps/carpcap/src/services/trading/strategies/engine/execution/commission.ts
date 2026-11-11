// Commission schemes: pluggable per-fill cost models.
//
// Ported from backtester/execution/commission.py (QuantJourney Backtester, Apache 2.0)

import type { CommissionScheme as CommissionConfigCore } from "../../core";

export interface CommissionModel {
  compute(price: number, quantity: number, notional: number): number;
}

export class ZeroCommission implements CommissionModel {
  compute(): number {
    return 0;
  }
}

/** Fixed cost per share with a minimum and an optional cap as a fraction of notional. */
export class PerShareCommission implements CommissionModel {
  constructor(
    readonly costPerShare = 0.005,
    readonly minPerOrder = 1.0,
    readonly maxPct = 0.005,
  ) {}

  compute(_price: number, quantity: number, notional: number): number {
    const raw = Math.abs(quantity) * this.costPerShare;
    const capped = this.maxPct ? Math.min(raw, Math.abs(notional) * this.maxPct) : raw;
    return Math.max(capped, this.minPerOrder);
  }
}

/** Commission as fixed basis points of notional. */
export class FixedBpsCommission implements CommissionModel {
  constructor(
    readonly bps = 1.0,
    readonly minPerOrder = 0.0,
  ) {}

  compute(_price: number, _quantity: number, notional: number): number {
    return Math.max((Math.abs(notional) * this.bps) / 10_000, this.minPerOrder);
  }
}

/** Volume tiers as [threshold, ratePerShare] pairs. Quantity beyond the last tier is not charged. */
export class TieredCommission implements CommissionModel {
  constructor(
    readonly tiers: ReadonlyArray<readonly [number, number]>,
    readonly minPerOrder = 0.35,
  ) {}

  compute(_price: number, quantity: number): number {
    let remaining = Math.abs(quantity);
    let total = 0;
    let prev = 0;
    for (const [threshold, rate] of [...this.tiers].sort((a, b) => a[0] - b[0])) {
      const tierQty = Math.min(remaining, threshold - prev);
      if (tierQty <= 0) break;
      total += tierQty * rate;
      remaining -= tierQty;
      prev = threshold;
    }
    return Math.max(total, this.minPerOrder);
  }
}

/** Mirrors the Python CommissionConfig (same field defaults). */
export interface CommissionConfig {
  scheme?: "zero" | "per_share" | "fixed_bps" | "tiered";
  bps?: number;
  costPerShare?: number;
  minPerOrder?: number;
  maxPct?: number;
  tiers?: ReadonlyArray<readonly [number, number]>;
}

export function buildCommission(cfg: CommissionConfig = {}): CommissionModel {
  const scheme = cfg.scheme ?? "fixed_bps";
  const minPerOrder = cfg.minPerOrder ?? 1.0;
  switch (scheme) {
    case "zero":
      return new ZeroCommission();
    case "per_share":
      return new PerShareCommission(cfg.costPerShare ?? 0.005, minPerOrder, cfg.maxPct ?? 0.005);
    case "fixed_bps":
      return new FixedBpsCommission(cfg.bps ?? 1.0, minPerOrder);
    case "tiered":
      return new TieredCommission(cfg.tiers ?? [[Infinity, 0.001]], minPerOrder);
    default:
      throw new Error(`Unknown commission scheme: ${String(scheme)}. Options: zero, per_share, fixed_bps, tiered`);
  }
}

/**
 * Build a model from a strategy config's `commission` field. Not in the
 * Python module: strategy configs there pass model instances directly.
 * Fields the core type omits fall back to the Python class defaults.
 */
export function commissionFromConfig(cfg: CommissionConfigCore | undefined): CommissionModel {
  if (!cfg) return new ZeroCommission();
  if (cfg.type === "fixed_bps") return new FixedBpsCommission(cfg.bps);
  return new PerShareCommission(cfg.costPerShare, cfg.minPerOrder, cfg.maxPct ?? 0.005);
}
