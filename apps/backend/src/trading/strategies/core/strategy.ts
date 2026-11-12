// Base classes for the ported strategies. A backtest engine is expected to
// set `data` (and, for order strategies, `broker`) before calling the
// compute hooks, the same way the Python Backtester base class did.

import type { Frame } from './frame';
import type {
  Bar,
  ContractSpec,
  FillEngine,
  Order,
  StrategyConfig,
} from './types';

/** Feature lookup over the loaded universe, e.g. "adj_close", "SMA_50_close". */
export interface InstrumentData {
  getFeature(name: string): Frame;
}

/** Engine services an order strategy can call. */
export interface Broker {
  fillEngine: FillEngine;
  /** Average entry price of the open position, if any. */
  getAverageEntryPrice(instrument: string): number | null;
  contractSpec(instrument: string): ContractSpec;
}

export abstract class Strategy {
  data!: InstrumentData;

  constructor(readonly config: StrategyConfig) {}

  get instruments(): string[] {
    return this.config.instruments;
  }
}

/** Produce target weights; the engine's rebalance policy trades them. */
export abstract class WeightsStrategy extends Strategy {
  /** Set by the engine from `computeSignals()` before `computeWeights()`. */
  signals!: Frame;

  abstract computeSignals(): Frame;
  abstract computeWeights(): Frame;
}

/** Submit explicit orders bar by bar. */
export abstract class OrdersStrategy extends Strategy {
  broker!: Broker;

  abstract computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void;

  protected get fillEngine(): FillEngine {
    return this.broker.fillEngine;
  }

  protected submit(order: Order): void {
    this.broker.fillEngine.submit(order);
  }

  protected cancelAll(instrument: string): void {
    this.broker.fillEngine.cancelAll({ instrument });
  }

  /** Whether the instrument has a live pending order. */
  protected hasPending(instrument: string): boolean {
    return this.broker.fillEngine.pendingOrders.some(
      (o) => o.instrument === instrument && o.isActive,
    );
  }

  /** Signed market order: positive buys, negative sells. */
  protected orderMarket(instrument: string, quantity: number, tag = ''): void {
    if (quantity === 0) return;
    this.submit({
      instrument,
      side: quantity > 0 ? 'buy' : 'sell',
      quantity: Math.abs(quantity),
      orderType: 'market',
      tag,
    });
  }
}
