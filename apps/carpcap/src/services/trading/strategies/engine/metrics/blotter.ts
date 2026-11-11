// Ported from backtester/engines/blotter.py (QuantJourney Backtester, Apache 2.0).
//
// An in-memory audit ledger of orders and fills. CSV save/load is not ported;
// the records are plain objects, so serialize them however you like.

import { randomUUID } from "node:crypto";

export interface OrderRecord {
  orderId: string;
  timestamp: string;
  instrument: string;
  orderType: string;
  quantity: number;
  orderPrice: number | null;
  status: string;
  // Set by recordEngineOrders only.
  side?: string | null;
  filledQuantity?: number;
  averageFillPrice?: number | null;
  timeInForce?: string | null;
  tag?: string;
  rejectionReason?: string | null;
}

export interface TradeRecord {
  tradeId: string;
  orderId: string;
  timestamp: string;
  instrument: string;
  side: string;
  quantity: number;
  price: number;
  tradeValue: number;
  transactionCost: number;
  slippage: number;
  theoreticalPrice: number | null;
  fillStatus: string | null;
}

/** The input a trade needs; everything optional gets the Python default. */
export type TradeInput = Pick<TradeRecord, "timestamp" | "instrument" | "side" | "quantity" | "price" | "tradeValue"> &
  Partial<Pick<TradeRecord, "orderId" | "tradeId" | "transactionCost" | "slippage" | "theoreticalPrice" | "fillStatus">>;

/** The fields of a fill-engine order the blotter reads. Enums may be strings or `{ value }`. */
export interface EngineOrderLike {
  orderId?: string | null;
  createdAt?: string | null;
  instrument?: string | null;
  orderType?: string | { value: string } | null;
  side?: string | { value: string } | null;
  status?: string | { value: string } | null;
  timeInForce?: string | { value: string } | null;
  quantity?: number | null;
  limitPrice?: number | null;
  stopPrice?: number | null;
  filledQty?: number;
  avgFillPrice?: number | null;
  tag?: string;
  rejectionReason?: string | null;
}

const enumValue = (v: string | { value: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.value;

const now = (): string => new Date().toISOString();

export class Blotter {
  trades: TradeRecord[] = [];
  orders: OrderRecord[] = [];

  reset(): void {
    this.trades = [];
    this.orders = [];
  }

  /** Record one order and return its id. */
  recordOrder(
    instrument: string,
    orderType: string,
    quantity: number,
    price: number | null,
    status = "Pending",
    orderId: string = randomUUID(),
    timestamp: string = now(),
  ): string {
    this.orders.push({ orderId, timestamp, instrument, orderType, quantity, orderPrice: price, status });
    return orderId;
  }

  /** Record one fill against an order. Unlike the bulk path, theoreticalPrice defaults to null. */
  recordTrade(trade: TradeInput & { orderId: string }): void {
    this.trades.push(toTradeRecord({ ...trade, theoreticalPrice: trade.theoreticalPrice ?? null }));
  }

  /** Record many orders from parallel arrays. */
  recordOrdersBulk(args: {
    instruments: string[];
    orderTypes: string[];
    quantities: number[];
    prices: (number | null)[];
    statuses?: string[];
    orderIds?: string[];
    timestamps?: string[];
  }): void {
    const n = args.instruments.length;
    const statuses = args.statuses ?? args.instruments.map(() => "Pending");
    const orderIds = args.orderIds ?? args.instruments.map(() => randomUUID());
    const timestamps = args.timestamps ?? args.instruments.map(now);
    const lengths = [args.orderTypes, args.quantities, args.prices, statuses, orderIds, timestamps].map((a) => a.length);
    if (lengths.some((len) => len !== n)) throw new Error("All input lists must have the same length");
    for (let i = 0; i < n; i++) {
      this.orders.push({
        orderId: orderIds[i]!,
        timestamp: timestamps[i]!,
        instrument: args.instruments[i]!,
        orderType: args.orderTypes[i]!,
        quantity: args.quantities[i]!,
        orderPrice: args.prices[i]!,
        status: statuses[i]!,
      });
    }
  }

  /** Upsert the final fill-engine state of each order, keyed by order id. */
  recordEngineOrders(orders: readonly EngineOrderLike[]): void {
    const existing = new Map(this.orders.map((o) => [o.orderId, o]));
    for (const order of orders) {
      if (order.orderId == null) continue;
      const record: OrderRecord = {
        orderId: order.orderId,
        timestamp: order.createdAt ?? "",
        instrument: order.instrument ?? "",
        orderType: enumValue(order.orderType) ?? "",
        side: enumValue(order.side),
        quantity: order.quantity ?? NaN,
        orderPrice: order.limitPrice ?? order.stopPrice ?? null,
        status: enumValue(order.status) ?? "",
        filledQuantity: order.filledQty ?? 0,
        averageFillPrice: order.avgFillPrice ?? null,
        timeInForce: enumValue(order.timeInForce),
        tag: order.tag ?? "",
        rejectionReason: order.rejectionReason ?? null,
      };
      const prior = existing.get(record.orderId);
      if (prior) Object.assign(prior, record);
      else {
        this.orders.push(record);
        existing.set(record.orderId, record);
      }
    }
  }

  /**
   * Record many fills. Any trade whose order id isn't on the blotter yet gets a
   * filled market order recorded for it first (one per order id).
   */
  recordTradesBulk(trades: readonly TradeInput[]): void {
    const rows = trades.map((t) => ({ ...t, orderId: t.orderId ?? randomUUID() }));
    const known = new Set(this.orders.map((o) => o.orderId));
    const missing = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!known.has(row.orderId) && !missing.has(row.orderId)) missing.set(row.orderId, row);
    if (missing.size) {
      const m = [...missing.values()];
      this.recordOrdersBulk({
        instruments: m.map((r) => r.instrument),
        orderTypes: m.map(() => "market"),
        quantities: m.map((r) => r.quantity),
        prices: m.map((r) => r.price),
        statuses: m.map(() => "Filled"),
        orderIds: m.map((r) => r.orderId),
        timestamps: m.map((r) => r.timestamp),
      });
    }
    for (const row of rows) this.trades.push(toTradeRecord(row));
  }

  getTrades(): TradeRecord[] {
    return this.trades;
  }

  getOrders(): OrderRecord[] {
    return this.orders;
  }
}

function toTradeRecord(t: TradeInput & { orderId: string }): TradeRecord {
  return {
    tradeId: t.tradeId ?? randomUUID(),
    orderId: t.orderId,
    timestamp: t.timestamp,
    instrument: t.instrument,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    tradeValue: t.tradeValue,
    transactionCost: t.transactionCost ?? 0,
    slippage: t.slippage ?? 0,
    theoreticalPrice: t.theoreticalPrice === undefined ? t.price : t.theoreticalPrice,
    fillStatus: t.fillStatus ?? null,
  };
}
