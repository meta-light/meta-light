import type { Frame } from '../../core/index';
import { RiskModel } from './base';
import { cloneFrame } from './util';

export interface MaRegimeOptions {
  period: number;
  maxPremium: number;
}

/** Zeroes long weights while price sits more than `maxPremium` above its `period`-bar SMA. */
export class MaRegimeGate extends RiskModel {
  readonly period: number;
  readonly maxPremium: number;

  constructor(opts: MaRegimeOptions) {
    super();
    if (!(opts.period > 1)) throw new Error('ma_regime period must be > 1');
    this.period = opts.period;
    this.maxPremium = opts.maxPremium;
  }

  // Risk models only see returns, so the price path is rebuilt as a growth index; the ratio to its SMA is unchanged.
  adjust(weights: Frame, returns: Frame): Frame {
    const out = cloneFrame(weights);
    weights.columns.forEach((c, j) => {
      const r = returns.colIndex(c);
      if (r < 0) return;
      let level = 1;
      let sum = 0;
      const window: number[] = [];
      for (let i = 0; i < weights.length; i++) {
        const ret = returns.values[i]?.[r] ?? NaN;
        if (Number.isFinite(ret)) level *= 1 + ret;
        window.push(level);
        sum += level;
        if (window.length > this.period) sum -= window.shift()!;
        if (window.length < this.period) continue;
        if (level > (sum / this.period) * (1 + this.maxPremium) && out.values[i]![j]! > 0) out.values[i]![j] = 0;
      }
    });
    return out;
  }

  override toString(): string {
    return `${this.name}(period=${this.period}, maxPremium=${this.maxPremium})`;
  }
}
