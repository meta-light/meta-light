// Ported from backtester/execution/order_types.py (QuantJourney Backtester, Apache 2.0)

import { randomUUID } from 'node:crypto';
import type {
  Bar,
  BracketSpec,
  Order,
  OrderSide,
  OrderType,
  PendingOrder,
  TimeInForce,
} from '../../core/index';

export type {
  Bar,
  BracketSpec,
  Order,
  OrderSide,
  OrderType,
  PendingOrder,
  TimeInForce,
};

export type OrderStatus =
  'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';

/** OHLCV bar. `volume` defaults to 0 when absent, as in the Python BarData. */
export type BarData = Bar;

export interface Fill {
  orderId: string;
  instrument: string;
  side: OrderSide;
  quantity: number;
  fillPrice: number;
  /** Absolute slippage per unit. */
  slippage: number;
  commission: number;
  timestamp: string;
  theoreticalPrice?: number;
  remainingQty: number;
  orderStatus: OrderStatus;
}

export interface OrderInit extends Order {
  orderId?: string;
  /** Timestamp of the bar the order was created on. Set on first bar if absent. */
  createdAt?: string;
  /** GTD expiry timestamp (inclusive). */
  expireAt?: string;
}

/** Python BracketSpec defaults: take-profit is a limit, stop-loss a stop. */
export function bracketTakeProfitType(spec: BracketSpec): OrderType {
  return spec.takeProfitType ?? 'limit';
}

export function bracketStopLossType(spec: BracketSpec): OrderType {
  return spec.stopLossType ?? 'stop';
}

export class ExecOrder implements PendingOrder {
  instrument: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  limitOffset?: number;
  trailAmount?: number;
  trailPercent?: number;
  bracket?: BracketSpec;
  ocoPairId?: string;
  timeInForce: TimeInForce;
  expiresAfterBars?: number;
  tag: string;

  orderId: string;
  status: OrderStatus = 'pending';
  filledQty = 0;
  avgFillPrice?: number;
  createdAt?: string;
  expireAt?: string;
  rejectionReason?: string;

  trailAnchor?: number;
  limitActivated = false;
  activatedLimitPrice?: number;
  barsLive = 0;
  bracketParentOrderId?: string;
  bracketChildren?: ExecOrder[];
  bracketSpec?: BracketSpec;
  bracketParentSide?: OrderSide;
  bracketChildrenActivated = false;

  constructor(init: OrderInit) {
    this.instrument = init.instrument;
    this.side = init.side;
    this.quantity = init.quantity;
    this.orderType = init.orderType;
    this.limitPrice = init.limitPrice;
    this.stopPrice = init.stopPrice;
    this.limitOffset = init.limitOffset;
    this.trailAmount = init.trailAmount;
    this.trailPercent = init.trailPercent;
    this.bracket = init.bracket;
    this.ocoPairId = init.ocoPairId;
    this.timeInForce = init.timeInForce ?? 'GTC';
    this.expiresAfterBars = init.expiresAfterBars;
    this.tag = init.tag ?? '';
    this.orderId = init.orderId ?? randomUUID();
    this.createdAt = init.createdAt;
    this.expireAt = init.expireAt;
  }

  static from(order: Order | OrderInit | ExecOrder): ExecOrder {
    return order instanceof ExecOrder ? order : new ExecOrder(order);
  }

  get remainingQty(): number {
    return this.quantity - this.filledQty;
  }

  get isActive(): boolean {
    return this.status === 'pending' || this.status === 'partial';
  }

  cancel(): void {
    if (this.isActive) this.status = 'cancelled';
  }
}
