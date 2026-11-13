// The ledger, pre-trade risk and rebalance engine live in other engine
// folders, so this file depends only on the minimal interfaces below.
//
// Ported from backtester/execution/simulator.py (QuantJourney Backtester, Apache 2.0)

import { Frame } from '../../core/index';
import type { FillEngine } from './fill-engine';
import {
  type BarData,
  ExecOrder,
  type Fill,
  type OrderInit,
} from './order-types';

export interface ContractSpecLike {
  notional(quantity: number, price: number): number;
  roundQuantity(quantity: number): number;
}

export interface LedgerLike<Snapshot = unknown, Result = unknown> {
  readonly initialCash: number;
  readonly instruments: readonly string[];
  readonly positions: Readonly<Record<string, number>>;
  readonly averageEntryPrice: Readonly<
    Record<string, number | null | undefined>
  >;
  reset(): void;
  prepareHistory(dates: readonly string[]): void;
  observeMark(instrument: string, price: number): void;
  isValidPrice(value: number, instrument: string): boolean;
  /** Returns at least the trade notional used for turnover accounting. */
  applyFill(fill: Fill): { tradeNotional: number };
  /** Returns [nav, positionValues]. */
  markToMarket(
    prices: Readonly<Record<string, number>>,
  ): [number, Record<string, number>];
  snapshot(args: {
    prices: Readonly<Record<string, number>>;
    nav: number;
  }): Snapshot;
  record(args: {
    date: string;
    nav: number;
    positionValues: Record<string, number>;
    prices: Readonly<Record<string, number>>;
  }): void;
  contractSpec(instrument: string): ContractSpecLike;
  exposureWeights(args: {
    prices: Readonly<Record<string, number>>;
    nav: number;
  }): Record<string, number>;
  result(): Result;
}

export interface PreTradeDecisionLike {
  approved: boolean;
  reason?: string | null;
}

export interface PreTradeContext<Snapshot = unknown> {
  portfolio: Snapshot;
  contractSpecResolver: (instrument: string) => ContractSpecLike;
  pendingOrders: readonly ExecOrder[];
}

export interface PreTradeCheck<Snapshot = unknown> {
  evaluate(
    order: ExecOrder,
    ctx: PreTradeContext<Snapshot>,
  ): PreTradeDecisionLike;
  evaluateBatch(
    orders: readonly ExecOrder[],
    ctx: PreTradeContext<Snapshot> & { allowCrossInstrumentNetting: boolean },
  ): { decisions: readonly PreTradeDecisionLike[] };
}

/** Default when no pre-trade risk is configured: approve everything (the Python PreTradeRisk() with no limits). */
export const APPROVE_ALL: PreTradeCheck = {
  evaluate: () => ({ approved: true }),
  evaluateBatch: (orders) => ({
    decisions: orders.map(() => ({ approved: true })),
  }),
};

export type BarCallback = (
  date: string,
  bars: Record<string, BarData>,
  positions: Record<string, number>,
  nav: number,
  averageEntryPrice: Record<string, number | null | undefined>,
) => void;

export type FillCallback = (fill: Fill, tradeNotional: number) => void;

export interface BatchSubmissionResult {
  submittedOrderIds: readonly string[];
  rejectedOrderIds: readonly string[];
}

export interface SimulatorInputs {
  close: Frame;
  open: Frame;
  high: Frame;
  low: Frame;
  /** Instruments missing from this frame get NaN volume. */
  volume?: Frame;
  onBar: BarCallback;
  onFill?: FillCallback;
}

/**
 * Align a frame to (dates x instruments) once, like pandas `.loc[dates, cols]`.
 * Missing labels throw unless `fill` is given, in which case they get `fill`.
 */
function align(
  frame: Frame,
  dates: readonly string[],
  instruments: readonly string[],
  name: string,
  fill?: number,
): number[][] {
  const rows = new Map(frame.index.map((d, i) => [d, i]));
  const cols = new Map(frame.columns.map((c, j) => [c, j]));
  return dates.map((date) => {
    const r = rows.get(date);
    return instruments.map((inst) => {
      const c = cols.get(inst);
      if (c !== undefined && r !== undefined) return frame.values[r]![c]!;
      if (fill !== undefined && c === undefined) return fill;
      throw new Error(`${name} frame is missing ${date}/${inst}`);
    });
  });
}

export class ExecutionSimulator<Snapshot = unknown, Result = unknown> {
  readonly fillEngine: FillEngine;
  readonly ledger: LedgerLike<Snapshot, Result>;
  readonly preTradeRisk: PreTradeCheck<Snapshot>;
  currentNav: number;
  private currentPrices: Record<string, number> = {};
  private riskPrices: Record<string, number> = {};
  private externalPreSubmit: FillEngine['preSubmitCheck'];
  private externalPreFill: FillEngine['preFillCheck'];

  constructor(args: {
    fillEngine: FillEngine;
    ledger: LedgerLike<Snapshot, Result>;
    preTradeRisk?: PreTradeCheck<Snapshot>;
  }) {
    this.fillEngine = args.fillEngine;
    this.ledger = args.ledger;
    this.preTradeRisk =
      args.preTradeRisk ?? (APPROVE_ALL as PreTradeCheck<Snapshot>);
    this.currentNav = args.ledger.initialCash;
  }

  /**
   * Run the bar loop. Phase order per bar is fixed:
   * build bars, process pending fills, mark NAV, strategy callback, record state.
   */
  run({
    close,
    open,
    high,
    low,
    volume,
    onBar,
    onFill,
  }: SimulatorInputs): Result {
    const engine = this.fillEngine;
    engine.reset();
    this.ledger.reset();
    const instruments = [...close.columns];
    const dates = close.index;
    this.ledger.prepareHistory(dates);

    const openV = align(open, dates, instruments, 'open');
    const highV = align(high, dates, instruments, 'high');
    const lowV = align(low, dates, instruments, 'low');
    const volumeV = volume
      ? align(volume, dates, instruments, 'volume', NaN)
      : null;
    const prevSubmit = engine.preSubmitCheck;
    const prevValidator = engine.priceValidator;
    const prevFill = engine.preFillCheck;
    this.externalPreSubmit = prevSubmit;
    this.externalPreFill = prevFill;
    engine.preSubmitCheck = (order) => this.preSubmitRejectionReason(order);
    engine.priceValidator = (instrument, value) =>
      this.ledger.isValidPrice(value, instrument);
    engine.preFillCheck = (order, price, qty, commission) =>
      this.preFillRejectionReason(order, price, qty, commission);

    try {
      dates.forEach((date, row) => {
        const bars: Record<string, BarData> = {};
        this.currentPrices = {};
        instruments.forEach((instrument, col) => {
          const closeValue = close.values[row]![col]!;
          this.ledger.observeMark(instrument, closeValue);
          this.currentPrices[instrument] = closeValue;
          bars[instrument] = {
            timestamp: date,
            open: openV[row]![col]!,
            high: highV[row]![col]!,
            low: lowV[row]![col]!,
            close: closeValue,
            volume: volumeV ? volumeV[row]![col]! : NaN,
          };
        });

        this.riskPrices = {};
        for (const instrument of instruments) {
          const bar = bars[instrument]!;
          this.riskPrices[instrument] =
            engine.fillAt === 'open' ? bar.open : bar.close;
        }

        for (const instrument of instruments) {
          for (const fill of engine.processBar(instrument, bars[instrument]!)) {
            const accounting = this.ledger.applyFill(fill);
            onFill?.(fill, accounting.tradeNotional);
          }
        }

        const [nav, positionValues] = this.ledger.markToMarket(
          this.currentPrices,
        );
        this.currentNav = nav;
        onBar(date, { ...bars }, { ...this.ledger.positions }, nav, {
          ...this.ledger.averageEntryPrice,
        });
        this.ledger.record({
          date,
          nav,
          positionValues,
          prices: this.currentPrices,
        });
      });
    } finally {
      engine.preSubmitCheck = prevSubmit;
      engine.priceValidator = prevValidator;
      engine.preFillCheck = prevFill;
      this.currentPrices = {};
      this.riskPrices = {};
      this.externalPreSubmit = undefined;
      this.externalPreFill = undefined;
    }
    return this.ledger.result();
  }

  private context(
    prices: Readonly<Record<string, number>>,
    nav: number,
    pending: readonly ExecOrder[],
  ): PreTradeContext<Snapshot> {
    return {
      portfolio: this.ledger.snapshot({ prices, nav }),
      contractSpecResolver: (instrument) =>
        this.ledger.contractSpec(instrument),
      pendingOrders: pending,
    };
  }

  private preSubmitRejectionReason(order: ExecOrder): string | null {
    const external = this.externalPreSubmit?.(order);
    if (external) return String(external);
    const decision = this.preTradeRisk.evaluate(
      order,
      this.context(
        this.currentPrices,
        this.currentNav,
        this.fillEngine.pendingOrders,
      ),
    );
    return decision.approved ? null : decision.reason || 'pre-trade rejected';
  }

  /** Re-check the fill as a market order at the fill price, against the other pending orders. */
  private preFillRejectionReason(
    order: ExecOrder,
    fillPrice: number,
    fillQty: number,
    commission: number,
  ): string | null {
    const external = this.externalPreFill?.(
      order,
      fillPrice,
      fillQty,
      commission,
    );
    if (external) return String(external);

    const riskPrices = { ...this.riskPrices, [order.instrument]: fillPrice };
    const riskNav = this.ledger.markToMarket(riskPrices)[0] - commission;
    const candidate = new ExecOrder({
      instrument: order.instrument,
      side: order.side,
      quantity: fillQty,
      orderType: 'market',
      createdAt: order.createdAt,
      tag: `fill_check:${order.orderId}`,
    });
    const others = this.fillEngine.pendingOrders.filter(
      (p) => p.orderId !== order.orderId,
    );
    const decision = this.preTradeRisk.evaluate(
      candidate,
      this.context(riskPrices, riskNav, others),
    );
    if (decision.approved) return null;
    return (
      'fill-time pre-trade rejected: ' + (decision.reason || 'portfolio limit')
    );
  }

  /** Evaluate a trade list as one deterministic batch before adding any order. */
  submitBatch(
    input: readonly (OrderInit | ExecOrder)[],
  ): BatchSubmissionResult {
    const candidates: ExecOrder[] = [];
    const rejected: string[] = [];
    for (const raw of input) {
      const order = ExecOrder.from(raw);
      const reason = this.externalPreSubmit?.(order);
      if (reason) {
        rejected.push(this.fillEngine.reject(order, String(reason)));
        continue;
      }
      candidates.push(order);
    }

    const { decisions } = this.preTradeRisk.evaluateBatch(candidates, {
      ...this.context(
        this.currentPrices,
        this.currentNav,
        this.fillEngine.pendingOrders,
      ),
      allowCrossInstrumentNetting: false,
    });
    if (decisions.length !== candidates.length)
      throw new Error(
        'evaluateBatch returned a decision count that does not match the orders',
      );
    const submitted: string[] = [];
    candidates.forEach((order, i) => {
      const decision = decisions[i]!;
      if (decision.approved)
        submitted.push(
          this.fillEngine.submit(order, { bypassPreSubmit: true }),
        );
      else
        rejected.push(
          this.fillEngine.reject(
            order,
            decision.reason || 'pre-trade rejected',
          ),
        );
    });
    return { submittedOrderIds: submitted, rejectedOrderIds: rejected };
  }
}

// Target-weight executor

export interface RebalanceDecisionLike {
  shouldRebalance: boolean;
  persistentWeights: Readonly<Record<string, number>>;
  reason?: string | null;
}

/** Subset of the stateful rebalance engine used by the executor. */
export interface RebalanceEngineLike {
  readonly policy: { readonly minTradeSize?: number };
  evaluate(args: {
    barIndex: number;
    decisionTime: string;
    executionTime: string | null;
    targetWeights: Record<string, number>;
    realizedWeights: Record<string, number>;
    positions: Readonly<Record<string, number>>;
    nav: number;
    available: Record<string, boolean>;
  }): RebalanceDecisionLike;
  recordFill(args: { timestamp: string; notional: number; nav: number }): void;
  recordSubmission(args: {
    timestamp: string;
    submitted: number;
    rejected: number;
    reason: string;
  }): void;
  recordTargetReconciled(args: { reason: string }): void;
}

const RISK_REASONS = new Set(['circuit_breaker', 'post_cooldown']);
const EMPTY: BatchSubmissionResult = {
  submittedOrderIds: [],
  rejectedOrderIds: [],
};

/** Convert stateful rebalance decisions into executable market orders. */
export class TargetWeightOrderExecutor {
  static readonly REBALANCE_TAG_PREFIX = 'rebalance:';

  readonly simulator: ExecutionSimulator;
  readonly targetWeights: Frame;
  private readonly rebalanceEngine: RebalanceEngineLike;
  private readonly instruments: readonly string[];
  private readonly datePositions = new Map<string, number>();
  private activeDesired: Record<string, number> | null = null;
  private activeReason = 'policy';
  private activeOrderIds = new Set<string>();
  private activeHadRejection = false;

  constructor(args: {
    targetWeights: Frame;
    simulator: ExecutionSimulator;
    rebalanceEngine: RebalanceEngineLike;
  }) {
    this.simulator = args.simulator;
    this.rebalanceEngine = args.rebalanceEngine;
    this.instruments = args.simulator.ledger.instruments;
    const known = new Set(this.instruments);
    const unknown = args.targetWeights.columns.filter((c) => !known.has(c));
    if (unknown.length)
      throw new Error(
        'Target weights contain unknown instruments: ' +
          [...unknown].sort().join(', '),
      );
    // Reindex to ledger instruments; missing columns and NaN become 0, infinities are an error.
    const tw = args.targetWeights;
    const values = tw.values.map((row) =>
      this.instruments.map((inst) => {
        const c = tw.colIndex(inst);
        const v = c < 0 ? 0 : row[c]!;
        if (v === Infinity || v === -Infinity)
          throw new Error('Target weights must not contain +/-inf');
        return Number.isNaN(v) ? 0 : v;
      }),
    );
    this.targetWeights = new Frame(tw.index, this.instruments, values);
    this.targetWeights.index.forEach((d, i) => this.datePositions.set(d, i));
  }

  private get fillEngine(): FillEngine {
    return this.simulator.fillEngine;
  }

  private get ledger(): LedgerLike {
    return this.simulator.ledger;
  }

  onFill = (fill: Fill, tradeNotional: number): void => {
    this.rebalanceEngine.recordFill({
      timestamp: fill.timestamp,
      notional: tradeNotional,
      nav: this.simulator.currentNav,
    });
  };

  onBar(
    date: string,
    bars: Readonly<Record<string, BarData>>,
    positions: Readonly<Record<string, number>>,
    nav: number,
  ): BatchSubmissionResult {
    const position = this.datePositions.get(date);
    if (position === undefined)
      throw new Error(`No target-weight row for simulation date ${date}`);
    const index = this.targetWeights.index;
    const nextDate = position + 1 < index.length ? index[position + 1]! : null;
    if (!Number.isFinite(nav) || nav <= 0) {
      this.cancelPendingRebalanceOrders();
      this.clearActiveTarget();
      throw new Error(
        `target-weight execution requires positive finite NAV; got ${nav} at ${date}`,
      );
    }
    const marks: Record<string, number> = {};
    for (const inst of this.instruments) marks[inst] = bars[inst]!.close;
    const realized = this.ledger.exposureWeights({ prices: marks, nav });
    const available: Record<string, boolean> = {};
    for (const inst of this.instruments)
      available[inst] = this.ledger.isValidPrice(marks[inst]!, inst);

    const decision = this.rebalanceEngine.evaluate({
      barIndex: position,
      decisionTime: date,
      executionTime: nextDate,
      targetWeights: this.targetWeights.rowRecord(position),
      realizedWeights: realized,
      positions,
      nav,
      available,
    });
    if (nextDate === null) {
      this.cancelPendingRebalanceOrders();
      this.clearActiveTarget();
      return EMPTY;
    }

    if (decision.shouldRebalance) {
      const desired = { ...decision.persistentWeights };
      const nextReason = decision.reason || 'policy';
      const sameIntent =
        this.activeDesired !== null &&
        weightsEqual(this.activeDesired, desired) &&
        (this.activeReason === nextReason ||
          (!RISK_REASONS.has(this.activeReason) &&
            !RISK_REASONS.has(nextReason)));
      if (sameIntent && this.pendingRebalanceOrders().length) return EMPTY;
      this.cancelPendingRebalanceOrders();
      this.activeDesired = desired;
      this.activeReason = nextReason;
      this.activeOrderIds = new Set();
      this.activeHadRejection = false;
    } else if (this.activeDesired === null) {
      return EMPTY;
    } else if (this.pendingRebalanceOrders().length) {
      return EMPTY;
    } else if (this.activeIntentCompleted()) {
      this.rebalanceEngine.recordTargetReconciled({
        reason: this.activeReason,
      });
      this.clearActiveTarget();
      return EMPTY;
    }

    const desired = this.activeDesired;
    const orders = this.buildOrders(
      date,
      this.activeReason,
      desired,
      positions,
      marks,
      nav,
    );
    if (!orders.length) {
      if (this.targetIsReconciled(desired, realized, positions, marks, nav)) {
        this.rebalanceEngine.recordTargetReconciled({
          reason: this.activeReason,
        });
        this.clearActiveTarget();
      }
      return EMPTY;
    }
    const result = this.simulator.submitBatch(orders);
    for (const id of result.submittedOrderIds) this.activeOrderIds.add(id);
    this.activeHadRejection =
      this.activeHadRejection || result.rejectedOrderIds.length > 0;
    this.rebalanceEngine.recordSubmission({
      timestamp: date,
      submitted: result.submittedOrderIds.length,
      rejected: result.rejectedOrderIds.length,
      reason: this.activeReason,
    });
    return result;
  }

  private activeIntentCompleted(): boolean {
    if (this.activeHadRejection || !this.activeOrderIds.size) return false;
    const statuses = new Map(
      this.fillEngine.orderHistory.map((o) => [o.orderId, o.status]),
    );
    return [...this.activeOrderIds].every(
      (id) => statuses.get(id) === 'filled',
    );
  }

  private clearActiveTarget(): void {
    this.activeDesired = null;
    this.activeReason = 'policy';
    this.activeOrderIds = new Set();
    this.activeHadRejection = false;
  }

  private targetIsReconciled(
    desired: Readonly<Record<string, number>>,
    realized: Readonly<Record<string, number>>,
    positions: Readonly<Record<string, number>>,
    marks: Readonly<Record<string, number>>,
    nav: number,
  ): boolean {
    const minTradeWeight = this.minTradeWeight(this.activeReason);
    for (const inst of this.instruments) {
      const price = marks[inst]!;
      const desiredWeight = desired[inst] ?? 0;
      if (!this.ledger.isValidPrice(price, inst)) {
        if (
          Math.abs(desiredWeight - (realized[inst] ?? 0)) >
          Math.max(minTradeWeight, 1e-12)
        )
          return false;
        continue;
      }
      const spec = this.ledger.contractSpec(inst);
      const unitNotional = spec.notional(1, price);
      if (!Number.isFinite(unitNotional) || unitNotional <= 0) return false;
      const targetQty = spec.roundQuantity(
        (nav * desiredWeight) / unitNotional,
      );
      const delta = Math.abs(targetQty - (positions[inst] ?? 0));
      if (delta <= 1e-12) continue;
      if ((delta * unitNotional) / Math.abs(nav) >= minTradeWeight)
        return false;
    }
    return true;
  }

  private pendingRebalanceOrders(): ExecOrder[] {
    return this.fillEngine.pendingOrders.filter(
      (o) =>
        o.isActive &&
        o.tag.startsWith(TargetWeightOrderExecutor.REBALANCE_TAG_PREFIX),
    );
  }

  private cancelPendingRebalanceOrders(): void {
    for (const o of this.fillEngine.pendingOrders) {
      if (o.tag.startsWith(TargetWeightOrderExecutor.REBALANCE_TAG_PREFIX))
        this.fillEngine.cancel(o.orderId);
    }
  }

  private minTradeWeight(reason: string): number {
    if (RISK_REASONS.has(reason)) return 0;
    return Math.max(this.rebalanceEngine.policy.minTradeSize ?? 0, 0);
  }

  /** Market orders to reach the desired weights; reductions first, sign flips split into close then open. */
  private buildOrders(
    date: string,
    reason: string,
    desired: Readonly<Record<string, number>>,
    positions: Readonly<Record<string, number>>,
    marks: Readonly<Record<string, number>>,
    nav: number,
  ): ExecOrder[] {
    const reductions: ExecOrder[] = [];
    const increases: ExecOrder[] = [];
    const minTradeWeight = this.minTradeWeight(reason);
    for (const inst of this.instruments) {
      const price = marks[inst]!;
      if (!this.ledger.isValidPrice(price, inst)) continue;
      const spec = this.ledger.contractSpec(inst);
      const unitNotional = spec.notional(1, price);
      if (!Number.isFinite(unitNotional) || unitNotional <= 0) continue;
      const targetQty = spec.roundQuantity(
        (nav * (desired[inst] ?? 0)) / unitNotional,
      );
      const currentQty = positions[inst] ?? 0;
      if (
        currentQty * targetQty < 0 &&
        Math.abs(currentQty) > 1e-12 &&
        Math.abs(targetQty) > 1e-12
      ) {
        reductions.push(
          this.orderFromDelta(inst, -currentQty, date, reason, 'close'),
        );
        increases.push(
          this.orderFromDelta(inst, targetQty, date, reason, 'open'),
        );
        continue;
      }
      const delta = targetQty - currentQty;
      if (Math.abs(delta) <= 1e-12) continue;
      const deltaWeight =
        (Math.abs(delta) * unitNotional) / Math.max(Math.abs(nav), 1e-12);
      if (deltaWeight + 1e-12 < minTradeWeight) continue;
      const order = this.orderFromDelta(inst, delta, date, reason, 'rebalance');
      if (Math.abs(targetQty) < Math.abs(currentQty) - 1e-12)
        reductions.push(order);
      else increases.push(order);
    }
    return [...reductions, ...increases];
  }

  private orderFromDelta(
    instrument: string,
    delta: number,
    date: string,
    reason: string,
    phase: string,
  ): ExecOrder {
    return new ExecOrder({
      instrument,
      side: delta > 0 ? 'buy' : 'sell',
      quantity: Math.abs(delta),
      orderType: 'market',
      createdAt: date,
      tag: `${TargetWeightOrderExecutor.REBALANCE_TAG_PREFIX}${reason}:${phase}`,
    });
  }
}

function weightsEqual(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every(
    (k) => Math.abs((left[k] ?? 0) - (right[k] ?? 0)) <= 1e-12,
  );
}
