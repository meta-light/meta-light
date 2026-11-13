// Ported from backtester/risk/pre_trade.py (QuantJourney Backtester, Apache 2.0).
//
// The default configuration is pass-through; margin, leverage and short limits
// only bind when explicitly configured because they depend on account and venue.

import type { ContractSpec, Order } from '../../core/index';

/**
 * Minimal portfolio state the checks need (a local stand-in for the ledger's
 * PortfolioSnapshot).
 */
export interface PortfolioSnapshot {
  cash: number;
  nav: number;
  /** Instrument to signed quantity. */
  positions: Record<string, number>;
  /** Instrument to latest mark; null or undefined means no usable price. */
  prices: Record<string, number | null | undefined>;
  marginUsed?: number;
  buyingPower?: number;
}

export interface RiskContractSpec {
  marginRequired(quantity: number, price: number): number;
  notional(quantity: number, price: number): number;
  assetClass?: 'equity' | 'future' | 'fx' | 'crypto' | 'option';
  inverse?: boolean;
}

export type ContractSpecResolver = (instrument: string) => RiskContractSpec;

/** Adapt core's ContractSpec, matching backtester ContractSpec.notional / margin_required. */
export function riskSpecFromCore(
  spec: ContractSpec,
  extra: {
    assetClass?: RiskContractSpec['assetClass'];
    inverse?: boolean;
  } = {},
): RiskContractSpec {
  const lotSize = spec.lotSize ?? 1;
  const margin = spec.margin ?? 0;
  const inverse = extra.inverse ?? false;
  const notional = (q: number, p: number): number =>
    inverse
      ? p !== 0
        ? (Math.abs(q) * spec.multiplier) / p
        : 0
      : Math.abs(q) * Math.abs(p) * spec.multiplier * lotSize;
  return {
    assetClass: extra.assetClass,
    inverse,
    notional,
    marginRequired: (q, p) =>
      margin > 0 ? Math.abs(q) * margin : notional(q, p),
  };
}

/** core Order plus the partial-fill state the Python Order carries. */
export type PreTradeOrder = Order & {
  /** Unfilled quantity; defaults to `quantity`. */
  remainingQty?: number;
  /** Only active pending orders are reserved; defaults to true. */
  isActive?: boolean;
};

export interface PreTradeDecision {
  approved: boolean;
  reason: string | null;
  projectedMargin: number;
  projectedBuyingPower: number;
  projectedGrossLeverage: number;
}

export interface PreTradeResult<O extends PreTradeOrder = PreTradeOrder> {
  approvedOrders: O[];
  rejectedOrders: O[];
  decisions: PreTradeDecision[];
}

export interface PreTradeRiskOptions {
  maxMarginUtilization?: number | null;
  maxGrossLeverage?: number | null;
  allowShort?: boolean;
  reservePendingOrders?: boolean;
  tolerance?: number;
}

/** Python's "{:.6g}" format. */
function fmtG(v: number): string {
  if (!Number.isFinite(v))
    return Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf';
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const p = Number(v.toPrecision(6));
  const e = Math.floor(Math.log10(Math.abs(p)));
  if (e < -4 || e >= 6 || exp >= 6) {
    const [m, x] = p.toExponential(5).split('e');
    const mant = m!.includes('.')
      ? m!.replace(/0+$/, '').replace(/\.$/, '')
      : m!;
    const n = Number(x);
    return `${mant}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
  }
  return String(p);
}

export class PreTradeRisk {
  readonly maxMarginUtilization: number | null;
  readonly maxGrossLeverage: number | null;
  readonly allowShort: boolean;
  readonly reservePendingOrders: boolean;
  readonly tolerance: number;

  constructor(opts: PreTradeRiskOptions = {}) {
    const mmu = opts.maxMarginUtilization ?? null;
    const mgl = opts.maxGrossLeverage ?? null;
    if (mmu !== null && mmu < 0)
      throw new Error('maxMarginUtilization must be non-negative');
    if (mgl !== null && mgl < 0)
      throw new Error('maxGrossLeverage must be non-negative');
    this.maxMarginUtilization = mmu;
    this.maxGrossLeverage = mgl;
    this.allowShort = opts.allowShort ?? true;
    this.reservePendingOrders = opts.reservePendingOrders ?? false;
    this.tolerance = opts.tolerance ?? 1e-9;
  }

  /** True when no portfolio limit can reject a finite order. */
  get isPassthrough(): boolean {
    return (
      this.maxMarginUtilization === null &&
      this.maxGrossLeverage === null &&
      this.allowShort
    );
  }

  /** Evaluate one order against projected positions and collateral. */
  evaluate(
    order: PreTradeOrder,
    portfolio: PortfolioSnapshot,
    resolveSpec: ContractSpecResolver,
    pendingOrders: readonly PreTradeOrder[] = [],
  ): PreTradeDecision {
    const quantity = Number(order.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0)
      return reject('order quantity must be finite and positive');

    const positions: Record<string, number> = { ...portfolio.positions };
    if (this.reservePendingOrders) {
      for (const p of pendingOrders)
        if (p.isActive ?? true) applyOrderDelta(positions, p);
    }
    const currentPositions = { ...positions };
    applyOrderDelta(positions, order);

    const projectedQty = positions[order.instrument] ?? 0;
    if (!this.allowShort && projectedQty < -this.tolerance) {
      const [margin, gross] = this.projectedRequirements(
        positions,
        portfolio,
        resolveSpec,
      );
      return {
        approved: false,
        reason: `short positions are disabled for ${order.instrument}`,
        projectedMargin: margin,
        projectedBuyingPower: portfolio.nav - margin,
        projectedGrossLeverage: gross,
      };
    }

    const [currentMargin] = this.projectedRequirements(
      currentPositions,
      portfolio,
      resolveSpec,
    );
    const [projectedMargin, projectedGross] = this.projectedRequirements(
      positions,
      portfolio,
      resolveSpec,
    );
    const decision = (
      approved: boolean,
      reason: string | null,
    ): PreTradeDecision => ({
      approved,
      reason,
      projectedMargin,
      projectedBuyingPower: portfolio.nav - projectedMargin,
      projectedGrossLeverage: projectedGross,
    });

    // Risk-reducing orders stay executable even when the book is already over
    // an opening limit; closes and deleveraging must always go through.
    const riskReducing = projectedMargin <= currentMargin + this.tolerance;
    if (!riskReducing && this.maxMarginUtilization !== null) {
      const allowed = Math.max(portfolio.nav, 0) * this.maxMarginUtilization;
      if (projectedMargin > allowed + this.tolerance) {
        return decision(
          false,
          `projected margin ${fmtG(projectedMargin)} exceeds limit ${fmtG(allowed)}`,
        );
      }
    }
    if (
      !riskReducing &&
      this.maxGrossLeverage !== null &&
      projectedGross > this.maxGrossLeverage + this.tolerance
    ) {
      return decision(
        false,
        `projected gross leverage ${fmtG(projectedGross)} exceeds limit ${fmtG(this.maxGrossLeverage)}`,
      );
    }
    return decision(true, null);
  }

  /**
   * Evaluate a trade list, applying approved deltas to later checks. When
   * `allowCrossInstrumentNetting` is false, an approved order only affects
   * later checks for the same instrument, so a planned sale cannot finance a
   * purchase of something else before it fills.
   */
  evaluateBatch<O extends PreTradeOrder>(
    orders: Iterable<O>,
    portfolio: PortfolioSnapshot,
    resolveSpec: ContractSpecResolver,
    pendingOrders: readonly PreTradeOrder[] = [],
    allowCrossInstrumentNetting = true,
  ): PreTradeResult<O> {
    const approvedOrders: O[] = [];
    const rejectedOrders: O[] = [];
    const decisions: PreTradeDecision[] = [];
    const working: Record<string, number> = { ...portfolio.positions };
    if (this.reservePendingOrders && allowCrossInstrumentNetting) {
      for (const p of pendingOrders)
        if (p.isActive ?? true) applyOrderDelta(working, p);
    }
    const conservative: Record<string, number> = { ...working };

    for (const order of orders) {
      let snapshotPositions: Record<string, number> = { ...working };
      if (!allowCrossInstrumentNetting) {
        snapshotPositions = { ...conservative };
        snapshotPositions[order.instrument] =
          working[order.instrument] ?? snapshotPositions[order.instrument] ?? 0;
      }
      const decision = this.evaluate(
        order,
        { ...portfolio, positions: snapshotPositions },
        resolveSpec,
        [],
      );
      decisions.push(decision);
      if (decision.approved) {
        approvedOrders.push(order);
        applyOrderDelta(working, order);
        if (!allowCrossInstrumentNetting) {
          const planned = working[order.instrument] ?? 0;
          const cons = conservative[order.instrument] ?? 0;
          if (Math.abs(planned) > Math.abs(cons) + this.tolerance)
            conservative[order.instrument] = planned;
        }
      } else {
        rejectedOrders.push(order);
      }
    }
    return { approvedOrders, rejectedOrders, decisions };
  }

  /** [margin, grossLeverage] for a set of positions at current marks. */
  private projectedRequirements(
    positions: Record<string, number>,
    portfolio: PortfolioSnapshot,
    resolveSpec: ContractSpecResolver,
  ): [number, number] {
    let margin = 0;
    let gross = 0;
    for (const [instrument, quantity] of Object.entries(positions)) {
      if (Math.abs(quantity) <= this.tolerance) continue;
      const price = portfolio.prices[instrument];
      // A position without a usable mark cannot safely increase.
      if (price === null || price === undefined || !Number.isFinite(price))
        return [Infinity, Infinity];
      const spec = resolveSpec(instrument);
      if (price <= 0 && !(spec.assetClass === 'future' && !spec.inverse))
        return [Infinity, Infinity];
      margin += spec.marginRequired(quantity, price);
      gross += spec.notional(quantity, price);
    }
    const nav = Math.abs(portfolio.nav);
    const leverage =
      nav > this.tolerance
        ? gross / nav
        : gross <= this.tolerance
          ? 0
          : Infinity;
    return [margin, leverage];
  }
}

function applyOrderDelta(
  positions: Record<string, number>,
  order: PreTradeOrder,
): void {
  const qty = order.remainingQty ?? order.quantity;
  positions[order.instrument] =
    (positions[order.instrument] ?? 0) + (order.side === 'buy' ? qty : -qty);
}

function reject(reason: string): PreTradeDecision {
  return {
    approved: false,
    reason,
    projectedMargin: NaN,
    projectedBuyingPower: NaN,
    projectedGrossLeverage: NaN,
  };
}
