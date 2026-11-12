// Fill engine: a stateful order book that processes pending orders against
// OHLCV bars. Supports market, limit, stop, stop-limit, trailing stop,
// trailing stop-limit, OCO and bracket orders, with slippage, commission,
// volume participation caps and time-in-force expiry.
//
// Same-bar convention: daily bars do not reveal the intrabar path, so stops
// are evaluated before limits, and limits before markets. Opening fills see
// only the previous bar's HLCV for slippage and the lagged mean volume for
// participation capacity.
//
// Ported from backtester/execution/fill_engine.py (QuantJourney Backtester, Apache 2.0)

import { randomUUID } from 'node:crypto';
import type {
  FillEngine as CoreFillEngine,
  Order,
  OrderType,
  TimeInForce,
} from '../../../../services/trading/strategies/core';
import { type CommissionModel, ZeroCommission } from './commission';
import {
  type BarData,
  type BracketSpec,
  ExecOrder,
  type Fill,
  type OrderInit,
  bracketStopLossType,
  bracketTakeProfitType,
} from './order-types';
import { NoSlippage, type Slippage } from './slippage';

export type FillAt = 'open' | 'close';

export interface FillEngineOptions {
  slippage?: Slippage;
  commission?: CommissionModel;
  fillAt?: FillAt;
  /** Max fraction of bar volume one instrument can fill per bar. `undefined` means uncapped. */
  maxVolumeParticipation?: number;
  volumeLookback?: number;
  expectedOpenVolumeFraction?: number;
  notionalFn?: (instrument: string, price: number, quantity: number) => number;
  /** Return a reason string to reject an order at submit time. */
  preSubmitCheck?: (order: ExecOrder) => string | null | undefined;
  /** Replaces the default `price > 0` check (e.g. to allow negative futures prices). */
  priceValidator?: (instrument: string, value: number) => boolean;
  /** Return a reason string to reject a fill. Receives price, quantity and incremental commission. */
  preFillCheck?: (
    order: ExecOrder,
    price: number,
    quantity: number,
    commission: number,
  ) => string | null | undefined;
}

interface CommissionState {
  quantity: number;
  notional: number;
  charged: number;
}

const ORDER_PRIORITY: Partial<Record<OrderType, number>> = {
  stop: 0,
  stop_limit: 1,
  stop_trail: 2,
  stop_trail_limit: 3,
  // OCO may carry a protective stop leg, so it sits with the stop family.
  oco: 4,
  limit: 5,
  market: 6,
  bracket: 7,
};

const TIFS: readonly TimeInForce[] = ['GTC', 'DAY', 'GTD'];

/** Compare bar timestamps: as dates when both parse, otherwise as strings (Python str ordering). */
function compareTimestamps(left: string, right: string): number {
  const l = Date.parse(left);
  const r = Date.parse(right);
  if (!Number.isNaN(l) && !Number.isNaN(r)) return l - r;
  return left < right ? -1 : left > right ? 1 : 0;
}

export class FillEngine implements CoreFillEngine {
  slippage: Slippage;
  commission: CommissionModel;
  readonly fillAt: FillAt;
  readonly maxVolumeParticipation?: number;
  readonly volumeLookback: number;
  readonly expectedOpenVolumeFraction: number;
  notionalFn?: FillEngineOptions['notionalFn'];
  preSubmitCheck?: FillEngineOptions['preSubmitCheck'];
  priceValidator?: FillEngineOptions['priceValidator'];
  preFillCheck?: FillEngineOptions['preFillCheck'];

  private orders = new Map<string, ExecOrder[]>();
  private ocoPairs = new Map<string, string[]>();
  private history: ExecOrder[] = [];
  private fills: Fill[] = [];
  private lastFillByInstrument = new Map<string, Fill>();
  private lastFillByOrder = new Map<string, Fill>();
  private commissionStateByOrder = new Map<string, CommissionState>();
  private lastBarByInstrument = new Map<string, BarData>();
  private volumeHistory = new Map<string, number[]>();

  constructor(opts: FillEngineOptions = {}) {
    this.slippage = opts.slippage ?? new NoSlippage();
    this.commission = opts.commission ?? new ZeroCommission();
    this.fillAt = opts.fillAt ?? 'open';
    this.maxVolumeParticipation = opts.maxVolumeParticipation;
    const lookback = opts.volumeLookback ?? 20;
    if (!Number.isInteger(lookback) || lookback <= 0)
      throw new Error('volume_lookback must be a positive integer');
    const openFraction = opts.expectedOpenVolumeFraction ?? 1.0;
    if (
      !Number.isFinite(openFraction) ||
      openFraction < 0 ||
      openFraction > 1
    ) {
      throw new Error('expected_open_volume_fraction must be between 0 and 1');
    }
    this.volumeLookback = lookback;
    this.expectedOpenVolumeFraction = openFraction;
    this.notionalFn = opts.notionalFn;
    this.preSubmitCheck = opts.preSubmitCheck;
    this.priceValidator = opts.priceValidator;
    this.preFillCheck = opts.preFillCheck;
  }

  /** Clear per-run state (orders, histories, OCO registry, commission state). Config is kept. */
  reset(): void {
    this.orders = new Map();
    this.ocoPairs = new Map();
    this.history = [];
    this.fills = [];
    this.lastFillByInstrument = new Map();
    this.lastFillByOrder = new Map();
    this.commissionStateByOrder = new Map();
    this.lastBarByInstrument = new Map();
    this.volumeHistory = new Map();
  }

  // Submit

  private ordersFor(instrument: string): ExecOrder[] {
    let list = this.orders.get(instrument);
    if (!list) {
      list = [];
      this.orders.set(instrument, list);
    }
    return list;
  }

  /** Submit an order and return its id. Plain core orders are wrapped in an `ExecOrder`. */
  submit(
    input: Order | OrderInit | ExecOrder,
    opts: { bypassPreSubmit?: boolean } = {},
  ): string {
    const order = ExecOrder.from(input);
    this.validateOrder(order);
    if (!opts.bypassPreSubmit && this.preSubmitCheck) {
      const reason = this.preSubmitCheck(order);
      if (reason) return this.reject(order, String(reason));
    }
    if (order.orderType === 'bracket') return this.submitBracket(order);

    this.ordersFor(order.instrument).push(order);
    this.history.push(order);
    if (order.ocoPairId) {
      const pair = this.ocoPairs.get(order.ocoPairId) ?? [];
      pair.push(order.orderId);
      this.ocoPairs.set(order.ocoPairId, pair);
    }
    return order.orderId;
  }

  /** Record a pre-trade rejection without adding a pending order. */
  reject(input: Order | OrderInit | ExecOrder, reason: string): string {
    const order = ExecOrder.from(input);
    order.status = 'rejected';
    order.rejectionReason = String(reason);
    this.history.push(order);
    return order.orderId;
  }

  /** Decompose a bracket into an entry plus an OCO pair (take-profit, stop-loss) parked until entry fills. */
  private submitBracket(order: ExecOrder): string {
    const bracket = order.bracket;
    if (!bracket) throw new Error('Bracket order requires a BracketSpec');
    this.validateBracket(bracket);

    const short = order.orderId.slice(0, 8);
    const shared = {
      instrument: order.instrument,
      quantity: order.quantity,
      timeInForce: order.timeInForce,
      expireAt: order.expireAt,
      expiresAfterBars: order.expiresAfterBars,
    };
    const entry = new ExecOrder({
      ...shared,
      side: order.side,
      orderType: order.limitPrice ? 'limit' : 'market',
      limitPrice: order.limitPrice,
      orderId: order.orderId,
      createdAt: order.createdAt,
      tag: `bracket_entry:${short}`,
    });

    const exitSide = order.side === 'buy' ? 'sell' : 'buy';
    const ocoId = randomUUID();
    const tp = new ExecOrder({
      ...shared,
      side: exitSide,
      orderType: bracketTakeProfitType(bracket),
      limitPrice: bracket.takeProfitPrice,
      ocoPairId: ocoId,
      tag: `bracket_tp:${short}`,
    });
    const sl = new ExecOrder({
      ...shared,
      side: exitSide,
      orderType: bracketStopLossType(bracket),
      stopPrice: bracket.stopLossPrice,
      limitPrice: bracket.stopLimitPrice,
      limitOffset: bracket.stopLimitOffset,
      trailAmount: bracket.trailAmount,
      trailPercent: bracket.trailPercent,
      ocoPairId: ocoId,
      tag: `bracket_sl:${short}`,
    });

    this.ocoPairs.set(ocoId, [tp.orderId, sl.orderId]);
    tp.bracketParentOrderId = entry.orderId;
    sl.bracketParentOrderId = entry.orderId;

    this.ordersFor(order.instrument).push(entry);
    this.history.push(entry, tp, sl);

    entry.bracketChildren = [tp, sl];
    entry.bracketSpec = bracket;
    entry.bracketParentSide = order.side;
    entry.bracketChildrenActivated = false;
    return entry.orderId;
  }

  // Cancel

  /** Cancel an active order by id. Returns true if found and cancelled. */
  cancel(orderId: string): boolean {
    for (const list of this.orders.values()) {
      for (const order of list) {
        if (order.orderId === orderId && order.isActive) {
          order.cancel();
          return true;
        }
      }
    }
    return false;
  }

  /** Cancel all active orders, optionally for one instrument. Returns the count cancelled. */
  cancelAll(filter?: string | { instrument?: string }): number {
    const instrument = typeof filter === 'string' ? filter : filter?.instrument;
    const targets = instrument ? [instrument] : [...this.orders.keys()];
    let count = 0;
    for (const inst of targets) {
      for (const order of this.orders.get(inst) ?? []) {
        if (order.isActive) {
          order.cancel();
          count++;
        }
      }
    }
    return count;
  }

  // Process bar

  /** Process all pending orders for one instrument against one bar. Returns the fills generated. */
  processBar(instrument: string, bar: BarData): Fill[] {
    const fills: Fill[] = [];
    const previousBar = this.lastBarByInstrument.get(instrument);
    const orders = this.orders.get(instrument) ?? [];
    if (!orders.length) {
      this.observeBar(instrument, bar);
      return fills;
    }

    let capacity = this.barFillCapacity(instrument, bar);
    const slippageBar = this.slippageReferenceBar(bar, previousBar);

    // Stable sort of a snapshot: children appended below are not processed this bar.
    const ordered = [...orders].sort(
      (a, b) =>
        (ORDER_PRIORITY[a.orderType] ?? 99) -
        (ORDER_PRIORITY[b.orderType] ?? 99),
    );
    for (const order of ordered) {
      if (!order.isActive) continue;
      if (this.expireBeforeBar(order, bar)) continue;

      const fill = this.tryFill(order, bar, capacity, slippageBar);
      if (!fill) {
        this.expireAfterBar(order, bar, false);
        continue;
      }
      fills.push(fill);
      this.recordFill(fill);
      if (capacity !== null) capacity = Math.max(0, capacity - fill.quantity);

      // Activate bracket children on the first entry fill (partial or full) so
      // the position is never unprotected; resize them on later partials.
      if (order.bracketChildren) {
        for (const child of order.bracketChildren)
          if (child.isActive) child.quantity = order.filledQty;
        if (!order.bracketChildrenActivated) {
          order.bracketChildrenActivated = true;
          this.prepareBracketChildren(order, fill);
          orders.push(...order.bracketChildren);
        }
      }

      // Any fill on an OCO leg cancels its sibling; a child fill cancels the parent remainder.
      if (order.ocoPairId) this.cancelOcoPair(order.ocoPairId, order.orderId);
      if (order.bracketParentOrderId !== undefined)
        this.cancel(order.bracketParentOrderId);

      if (order.isActive) this.expireAfterBar(order, bar, true);
    }

    this.orders.set(
      instrument,
      orders.filter((o) => o.isActive),
    );
    this.observeBar(instrument, bar);
    return fills;
  }

  // Fill logic

  private tryFill(
    order: ExecOrder,
    bar: BarData,
    maxQuantity: number | null,
    slippageBar: BarData,
  ): Fill | null {
    if (!this.barSupportsOrder(order, bar)) return null;
    // Ratchet the trail anchor first so the stop is live from the first bar.
    if (
      order.orderType === 'stop_trail' ||
      order.orderType === 'stop_trail_limit'
    )
      this.updateTrailAnchor(order, bar);

    const theoretical = this.getTheoreticalPrice(order, bar);
    if (theoretical === null || !this.validPrice(order.instrument, theoretical))
      return null;

    const fillQty = this.fillQuantity(order, maxQuantity);
    if (fillQty <= 0) return null;

    // Limit-like orders are clamped back to price-or-better after slippage.
    const slipped = this.slippage.compute(
      theoretical,
      fillQty,
      order.side,
      slippageBar,
    );
    if (!this.validPrice(order.instrument, slipped)) return null;
    const fillPrice = this.applyLimitPriceConstraint(
      order,
      slipped,
      theoretical,
    );
    if (!this.validPrice(order.instrument, fillPrice)) return null;

    const notional = this.tradeNotional(order.instrument, fillPrice, fillQty);
    let commission = this.incrementalCommission(
      order,
      fillPrice,
      fillQty,
      notional,
      false,
    );
    if (this.preFillCheck) {
      const reason = this.preFillCheck(order, fillPrice, fillQty, commission);
      if (reason) {
        order.status = 'rejected';
        order.rejectionReason = String(reason);
        return null;
      }
    }
    commission = this.incrementalCommission(
      order,
      fillPrice,
      fillQty,
      notional,
      true,
    );

    const previousFilled = order.filledQty;
    order.filledQty += fillQty;
    order.avgFillPrice =
      order.avgFillPrice === undefined || previousFilled <= 0
        ? fillPrice
        : (order.avgFillPrice * previousFilled + fillPrice * fillQty) /
          order.filledQty;
    order.status = order.remainingQty <= 1e-12 ? 'filled' : 'partial';

    return {
      orderId: order.orderId,
      instrument: order.instrument,
      side: order.side,
      quantity: fillQty,
      fillPrice,
      slippage: Math.abs(fillPrice - theoretical),
      commission,
      timestamp: bar.timestamp,
      theoreticalPrice: theoretical,
      remainingQty: Math.max(order.remainingQty, 0),
      orderStatus: order.status,
    };
  }

  private validPrice(instrument: string, value: number | undefined): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    return this.priceValidator
      ? Boolean(this.priceValidator(instrument, value))
      : value > 0;
  }

  /** Validate only the prices this order's fill rule can observe. */
  private barSupportsOrder(order: ExecOrder, bar: BarData): boolean {
    const valid = (v: number): boolean => this.validPrice(order.instrument, v);
    const buy = order.side === 'buy';
    switch (order.orderType) {
      case 'market':
        return valid(this.fillAt === 'open' ? bar.open : bar.close);
      case 'limit':
        return valid(buy ? bar.low : bar.high) && valid(bar.open);
      case 'stop':
      case 'stop_limit':
        return valid(buy ? bar.high : bar.low) && valid(bar.open);
      case 'stop_trail':
      case 'stop_trail_limit':
        return valid(bar.open) && valid(bar.high) && valid(bar.low);
      case 'oco': {
        const required = [bar.open];
        if (order.stopPrice !== undefined)
          required.push(buy ? bar.high : bar.low);
        if (order.limitPrice !== undefined)
          required.push(buy ? bar.low : bar.high);
        return required.every(valid);
      }
      default:
        return false;
    }
  }

  /** Pre-slippage fill price, or null if the order is not triggered on this bar. */
  private getTheoreticalPrice(order: ExecOrder, bar: BarData): number | null {
    const buy = order.side === 'buy';
    switch (order.orderType) {
      case 'market':
        return this.fillAt === 'open' ? bar.open : bar.close;
      case 'limit': {
        const l = order.limitPrice;
        if (l === undefined) return null;
        if (buy && bar.low <= l) return Math.min(l, bar.open);
        if (!buy && bar.high >= l) return Math.max(l, bar.open);
        return null;
      }
      case 'stop': {
        const s = order.stopPrice;
        if (s === undefined) return null;
        if (buy && bar.high >= s) return Math.max(s, bar.open);
        if (!buy && bar.low <= s) return Math.min(s, bar.open);
        return null;
      }
      case 'stop_limit':
        return this.getStopLimitPrice(order, bar);
      case 'stop_trail': {
        const eff = this.computeTrailStop(order);
        if (eff === null) return null;
        if (!buy && bar.low <= eff) return Math.min(eff, bar.open);
        if (buy && bar.high >= eff) return Math.max(eff, bar.open);
        return null;
      }
      case 'stop_trail_limit':
        return this.getTrailingStopLimitPrice(order, bar);
      case 'oco': {
        // Stop leg first, per the same-bar convention.
        const s = order.stopPrice;
        if (s !== undefined) {
          if (buy && bar.high >= s) return Math.max(s, bar.open);
          if (!buy && bar.low <= s) return Math.min(s, bar.open);
        }
        const l = order.limitPrice;
        if (l !== undefined) {
          if (buy && bar.low <= l) return Math.min(l, bar.open);
          if (!buy && bar.high >= l) return Math.max(l, bar.open);
        }
        return null;
      }
      default:
        return null;
    }
  }

  private activeLimitPrice(
    order: ExecOrder,
    theoretical: number,
  ): number | undefined {
    if (order.orderType === 'limit') return order.limitPrice;
    if (
      order.orderType === 'stop_limit' ||
      order.orderType === 'stop_trail_limit'
    ) {
      return order.activatedLimitPrice || order.limitPrice;
    }
    if (order.orderType === 'oco' && order.limitPrice !== undefined) {
      if (order.side === 'buy' && theoretical <= order.limitPrice)
        return order.limitPrice;
      if (order.side === 'sell' && theoretical >= order.limitPrice)
        return order.limitPrice;
    }
    return undefined;
  }

  private applyLimitPriceConstraint(
    order: ExecOrder,
    fillPrice: number,
    theoretical: number,
  ): number {
    const limit = this.activeLimitPrice(order, theoretical);
    if (limit === undefined) return fillPrice;
    return order.side === 'buy'
      ? Math.min(fillPrice, limit)
      : Math.max(fillPrice, limit);
  }

  /** Charge commission on the cumulative order so per-order minimums apply once across partial fills. */
  private incrementalCommission(
    order: ExecOrder,
    price: number,
    qty: number,
    notional: number,
    commit: boolean,
  ): number {
    const state = this.commissionStateByOrder.get(order.orderId) ?? {
      quantity: 0,
      notional: 0,
      charged: 0,
    };
    const cumQty = state.quantity + Math.abs(qty);
    const cumNotional = state.notional + Math.abs(notional);
    const due = this.commission.compute(price, cumQty, cumNotional);
    const incremental = Math.max(0, due - state.charged);
    if (commit) {
      this.commissionStateByOrder.set(order.orderId, {
        quantity: cumQty,
        notional: cumNotional,
        charged: state.charged + incremental,
      });
    }
    return incremental;
  }

  private tradeNotional(
    instrument: string,
    price: number,
    quantity: number,
  ): number {
    return this.notionalFn
      ? this.notionalFn(instrument, price, quantity)
      : price * quantity;
  }

  private computeTrailStop(order: ExecOrder): number | null {
    const anchor = order.trailAnchor;
    if (anchor === undefined) return null;
    let distance: number;
    if (order.trailAmount !== undefined) distance = order.trailAmount;
    else if (order.trailPercent !== undefined)
      distance = anchor * order.trailPercent;
    else return null;
    return order.side === 'sell' ? anchor - distance : anchor + distance;
  }

  /** Activate on the stop, then fill only at or better than the limit. */
  private getStopLimitPrice(order: ExecOrder, bar: BarData): number | null {
    const s = order.stopPrice;
    if (s === undefined || order.limitPrice === undefined) return null;
    let reference = bar.open;
    if (!order.limitActivated) {
      // On the activation bar the fill cannot reference prices from before the trigger.
      if (order.side === 'buy' && bar.high >= s)
        reference = Math.max(s, bar.open);
      else if (order.side === 'sell' && bar.low <= s)
        reference = Math.min(s, bar.open);
      else return null;
      order.limitActivated = true;
      order.activatedLimitPrice = order.limitPrice;
    }
    return this.getLimitPrice(order, bar, order.activatedLimitPrice, reference);
  }

  private getTrailingStopLimitPrice(
    order: ExecOrder,
    bar: BarData,
  ): number | null {
    const eff = this.computeTrailStop(order);
    if (eff === null) return null;
    let reference = bar.open;
    if (!order.limitActivated) {
      if (order.side === 'sell' && bar.low <= eff)
        reference = Math.min(eff, bar.open);
      else if (order.side === 'buy' && bar.high >= eff)
        reference = Math.max(eff, bar.open);
      else return null;
      order.limitActivated = true;
      order.activatedLimitPrice = this.trailLimitPrice(order, eff);
    }
    return this.getLimitPrice(order, bar, order.activatedLimitPrice, reference);
  }

  private trailLimitPrice(order: ExecOrder, effectiveStop: number): number {
    if (order.limitPrice !== undefined) return order.limitPrice;
    const offset = order.limitOffset || 0;
    return order.side === 'sell'
      ? effectiveStop - offset
      : effectiveStop + offset;
  }

  private getLimitPrice(
    order: ExecOrder,
    bar: BarData,
    limit: number | undefined,
    reference: number,
  ): number | null {
    if (limit === undefined) return null;
    if (order.side === 'buy' && bar.low <= limit)
      return Math.min(limit, reference);
    if (order.side === 'sell' && bar.high >= limit)
      return Math.max(limit, reference);
    return null;
  }

  /** Sell trails ratchet up with the high; buy trails ratchet down with the low. */
  private updateTrailAnchor(order: ExecOrder, bar: BarData): void {
    const current = order.trailAnchor;
    if (order.side === 'sell') {
      if (current === undefined || bar.high > current)
        order.trailAnchor = bar.high;
    } else if (current === undefined || bar.low < current) {
      order.trailAnchor = bar.low;
    }
  }

  private cancelOcoPair(ocoId: string, exceptId: string): void {
    for (const id of this.ocoPairs.get(ocoId) ?? [])
      if (id !== exceptId) this.cancel(id);
  }

  /** Resolve child prices that depend on the actual entry fill (pct-based TP/SL, stop-limit offset). */
  private prepareBracketChildren(entry: ExecOrder, entryFill: Fill): void {
    const bracket = entry.bracketSpec;
    if (!bracket || !entry.bracketChildren) return;
    const entryPrice = entry.avgFillPrice || entryFill.fillPrice;
    const isLong = (entry.bracketParentSide ?? entry.side) === 'buy';
    for (const child of entry.bracketChildren) {
      if (
        child.tag.startsWith('bracket_tp') &&
        bracket.takeProfitPct !== undefined
      ) {
        const pct = bracket.takeProfitPct;
        child.limitPrice = entryPrice * (isLong ? 1 + pct : 1 - pct);
      }
      if (child.tag.startsWith('bracket_sl')) {
        if (
          bracket.stopLossPct !== undefined &&
          (child.orderType === 'stop' || child.orderType === 'stop_limit')
        ) {
          const pct = bracket.stopLossPct;
          child.stopPrice = entryPrice * (isLong ? 1 - pct : 1 + pct);
        }
        if (
          child.orderType === 'stop_limit' &&
          child.limitPrice === undefined
        ) {
          const stop = child.stopPrice;
          if (stop !== undefined && bracket.stopLimitOffset !== undefined) {
            const off = bracket.stopLimitOffset;
            child.limitPrice = child.side === 'sell' ? stop - off : stop + off;
          }
        }
      }
    }
  }

  private fillQuantity(order: ExecOrder, maxQuantity: number | null): number {
    const remaining = Math.max(order.remainingQty, 0);
    return maxQuantity === null
      ? remaining
      : Math.min(remaining, Math.max(maxQuantity, 0));
  }

  /** Per-bar fill capacity under the participation cap; null when uncapped. Fails closed at 0. */
  private barFillCapacity(instrument: string, bar: BarData): number | null {
    const participation = this.maxVolumeParticipation;
    if (participation === undefined || participation === null) return null;
    if (participation <= 0) return 0;
    let volume: number;
    if (this.fillAt === 'open') {
      const obs = this.volumeHistory.get(instrument);
      if (!obs || !obs.length) return 0;
      volume =
        (obs.reduce((a, b) => a + b, 0) / obs.length) *
        this.expectedOpenVolumeFraction;
    } else {
      volume = bar.volume ?? 0;
    }
    if (!Number.isFinite(volume)) return 0;
    return Math.max(volume, 0) * participation;
  }

  /** Expose only information available at the configured fill time. */
  private slippageReferenceBar(
    bar: BarData,
    previous: BarData | undefined,
  ): BarData {
    if (this.fillAt !== 'open') return bar;
    const src = previous ?? { high: NaN, low: NaN, close: NaN, volume: NaN };
    return {
      timestamp: bar.timestamp,
      open: bar.open,
      high: src.high,
      low: src.low,
      close: src.close,
      volume: src.volume ?? 0,
    };
  }

  private observeBar(instrument: string, bar: BarData): void {
    this.lastBarByInstrument.set(instrument, bar);
    const volume = bar.volume ?? 0;
    if (Number.isFinite(volume) && volume >= 0) {
      let hist = this.volumeHistory.get(instrument);
      if (!hist) {
        hist = [];
        this.volumeHistory.set(instrument, hist);
      }
      hist.push(volume);
      if (hist.length > this.volumeLookback) hist.shift();
    }
  }

  private normalizeTif(order: ExecOrder): TimeInForce {
    const tif = String(order.timeInForce).toUpperCase() as TimeInForce;
    if (!TIFS.includes(tif))
      throw new Error(`Unknown time_in_force: ${String(order.timeInForce)}`);
    return tif;
  }

  private expireBeforeBar(order: ExecOrder, bar: BarData): boolean {
    if (order.createdAt === undefined) order.createdAt = bar.timestamp;
    if (
      order.expireAt !== undefined &&
      compareTimestamps(bar.timestamp, order.expireAt) > 0
    ) {
      order.status = 'expired';
      return true;
    }
    return false;
  }

  private expireAfterBar(
    order: ExecOrder,
    bar: BarData,
    filledThisBar: boolean,
  ): boolean {
    if (!order.isActive) return false;
    // Bars with a fill do not count toward expiresAfterBars.
    if (!filledThisBar) order.barsLive += 1;
    const expire =
      this.normalizeTif(order) === 'DAY' ||
      (order.expiresAfterBars !== undefined &&
        order.barsLive >= order.expiresAfterBars) ||
      (order.expireAt !== undefined &&
        compareTimestamps(bar.timestamp, order.expireAt) >= 0);
    if (expire) order.status = 'expired';
    return expire;
  }

  private recordFill(fill: Fill): void {
    this.fills.push(fill);
    this.lastFillByInstrument.set(fill.instrument, fill);
    this.lastFillByOrder.set(fill.orderId, fill);
  }

  private validateOrder(order: ExecOrder): void {
    if (!Number.isFinite(order.quantity) || order.quantity <= 0)
      throw new Error('Order quantity must be finite and positive');
    const t = order.orderType;
    if (t === 'limit' && order.limitPrice === undefined)
      throw new Error('LIMIT order requires limit_price');
    if (t === 'stop' && order.stopPrice === undefined)
      throw new Error('STOP order requires stop_price');
    if (
      t === 'stop_limit' &&
      (order.stopPrice === undefined || order.limitPrice === undefined)
    ) {
      throw new Error('STOP_LIMIT order requires stop_price and limit_price');
    }
    if (
      (t === 'stop_trail' || t === 'stop_trail_limit') &&
      order.trailAmount === undefined &&
      order.trailPercent === undefined
    ) {
      throw new Error(
        `${t.toUpperCase()} order requires trail_amount or trail_percent`,
      );
    }
    this.normalizeTif(order);
  }

  private validateBracket(b: BracketSpec): void {
    const tpType = bracketTakeProfitType(b);
    const slType = bracketStopLossType(b);
    if (
      tpType === 'limit' &&
      b.takeProfitPrice === undefined &&
      b.takeProfitPct === undefined
    ) {
      throw new Error(
        'Bracket LIMIT take-profit requires take_profit_price or take_profit_pct',
      );
    }
    if (
      slType === 'stop' &&
      b.stopLossPrice === undefined &&
      b.stopLossPct === undefined
    ) {
      throw new Error(
        'Bracket STOP stop-loss requires stop_loss_price or stop_loss_pct',
      );
    }
    if (slType === 'stop_limit') {
      if (b.stopLossPrice === undefined && b.stopLossPct === undefined) {
        throw new Error(
          'Bracket STOP_LIMIT stop-loss requires stop_loss_price or stop_loss_pct',
        );
      }
      if (b.stopLimitPrice === undefined && b.stopLimitOffset === undefined) {
        throw new Error(
          'Bracket STOP_LIMIT stop-loss requires stop_limit_price or stop_limit_offset',
        );
      }
    }
    if (
      (slType === 'stop_trail' || slType === 'stop_trail_limit') &&
      b.trailAmount === undefined &&
      b.trailPercent === undefined
    ) {
      throw new Error(
        'Bracket trailing stop-loss requires trail_amount or trail_percent',
      );
    }
  }

  // Queries

  /** All active pending orders across instruments. */
  get pendingOrders(): ExecOrder[] {
    const out: ExecOrder[] = [];
    for (const list of this.orders.values())
      for (const o of list) if (o.isActive) out.push(o);
    return out;
  }

  /** Every order ever submitted, including rejected and bracket children. */
  get orderHistory(): ExecOrder[] {
    return [...this.history];
  }

  get fillHistory(): Fill[] {
    return [...this.fills];
  }

  lastFill(instrument?: string): Fill | undefined {
    if (instrument !== undefined)
      return this.lastFillByInstrument.get(instrument);
    return this.fills[this.fills.length - 1];
  }

  lastFillPrice(instrument?: string): number | undefined {
    return this.lastFill(instrument)?.fillPrice;
  }

  lastFillForOrder(orderId: string): Fill | undefined {
    return this.lastFillByOrder.get(orderId);
  }
}
