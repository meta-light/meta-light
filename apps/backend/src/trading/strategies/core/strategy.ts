import type { Frame } from './frame';
import type {
  Bar,
  ContractSpec,
  FillEngine,
  Order,
  StrategyConfig,
} from './types';

export interface InstrumentData {
  getFeature(name: string): Frame;
}

export interface Broker {
  fillEngine: FillEngine;
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

export abstract class WeightsStrategy extends Strategy {
  signals!: Frame;

  abstract computeSignals(): Frame;
  abstract computeWeights(): Frame;
}

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

  protected unitsFor(instrument: string, notional: number, price: number): number {
    const raw = notional / price;
    const spec = this.broker.contractSpec(instrument);
    return spec.roundQuantity ? spec.roundQuantity(raw) : Math.trunc(raw);
  }

  protected submit(order: Order): void {
    this.broker.fillEngine.submit(order);
  }

  protected cancelAll(instrument: string): void {
    this.broker.fillEngine.cancelAll({ instrument });
  }

  protected hasPending(instrument: string): boolean {
    return this.broker.fillEngine.pendingOrders.some(
      (o) => o.instrument === instrument && o.isActive,
    );
  }

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
