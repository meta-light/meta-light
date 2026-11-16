import { Frame } from '../../core/index';

export interface RiskMetadata {
  periodsPerYear?: number;
  sectors?: Record<string, string>;
}

export abstract class RiskModel {
  abstract adjust(
    weights: Frame,
    returns: Frame,
    metadata?: RiskMetadata,
  ): Frame;

  get name(): string {
    return this.constructor.name;
  }

  toString(): string {
    return `${this.name}()`;
  }
}

export class RiskModelChain extends RiskModel {
  readonly models: readonly RiskModel[];

  constructor(models: RiskModel[]) {
    super();
    if (!models.length)
      throw new Error('RiskModelChain requires at least one model');
    this.models = [...models];
  }

  adjust(weights: Frame, returns: Frame, metadata?: RiskMetadata): Frame {
    let w = weights;
    for (const model of this.models) w = model.adjust(w, returns, metadata);
    return w;
  }

  override get name(): string {
    return `Chain(${this.models.map((m) => m.name).join(', ')})`;
  }

  override toString(): string {
    return this.name;
  }

  get length(): number {
    return this.models.length;
  }
}

export function returnsPreserveGaps(prices: Frame): Frame {
  const values = prices.values.map((row, i) =>
    row.map((p, j) => {
      if (i === 0) return Number.isNaN(p) ? NaN : 0;
      return p / prices.values[i - 1]![j]! - 1;
    }),
  );
  return new Frame(prices.index, prices.columns, values);
}
