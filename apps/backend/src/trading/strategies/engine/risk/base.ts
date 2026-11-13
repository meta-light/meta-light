// Ported from backtester/risk/base.py (QuantJourney Backtester, Apache 2.0).

import { Frame } from '../../core/index';

export interface RiskMetadata {
  /** Bars per year, used for annualising vol. Defaults to 252. */
  periodsPerYear?: number;
  /** Instrument to sector map, needed for PositionLimitModel sector limits. */
  sectors?: Record<string, string>;
}

/**
 * Receives raw target weights and historical asset returns (same shape and
 * columns, rows = dates) and returns adjusted weights of the same shape.
 */
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

/** Compose models sequentially: the output of model i feeds model i + 1. */
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

/**
 * Returns fed to risk models (core.py `_compute_returns_preserve_gaps`):
 * simple returns with NaN gaps left in place, and 0 on the first row for
 * instruments that already have a price.
 */
export function returnsPreserveGaps(prices: Frame): Frame {
  const values = prices.values.map((row, i) =>
    row.map((p, j) => {
      if (i === 0) return Number.isNaN(p) ? NaN : 0;
      return p / prices.values[i - 1]![j]! - 1;
    }),
  );
  return new Frame(prices.index, prices.columns, values);
}
