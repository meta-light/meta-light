import { type Frame, isNum, rolling, shift } from '../../core/index';
import { RiskModel, type RiskMetadata } from './base';
import { absSum, annFactorFor, cloneFrame, nanStd, sign } from './util';

export interface InverseVolOptions {
  lookback?: number;
  annFactor?: number | null;
  minVol?: number;
  blendAlpha?: boolean;
}

export class InverseVolModel extends RiskModel {
  readonly lookback: number;
  readonly annFactor: number | null;
  readonly minVol: number;
  readonly blendAlpha: boolean;

  constructor(opts: InverseVolOptions = {}) {
    super();
    this.lookback = opts.lookback ?? 63;
    this.annFactor = opts.annFactor ?? null;
    this.minVol = opts.minVol ?? 0.01;
    this.blendAlpha = opts.blendAlpha ?? true;
  }

  adjust(weights: Frame, returns: Frame, metadata?: RiskMetadata): Frame {
    const n = weights.length;
    if (n === 0) return weights;

    const out = cloneFrame(weights);
    const ann = annFactorFor(this.annFactor, metadata?.periodsPerYear);

    const vols = weights.columns.map((c) => {
      const j = returns.colIndex(c);
      if (j < 0) return weights.index.map(() => NaN);
      const v = shift(
        rolling(returns.col(c), this.lookback, nanStd, 2),
        1,
      ).slice(0, n);
      while (v.length < n) v.push(NaN);
      return v.map((x) => (isNum(x) ? Math.max(x * ann, this.minVol) : NaN));
    });

    for (let i = this.lookback; i < n; i++) {
      const rowW = weights.values[i]!;
      const blended = rowW.map((w, j) => {
        if (!(Math.abs(w) > 1e-10)) return 0;
        const inv = 1 / vols[j]![i]!;
        return (this.blendAlpha ? w : sign(w)) * inv;
      });
      const total = absSum(blended);
      const originalExposure = absSum(rowW);
      out.values[i] =
        total < 1e-10
          ? blended.map(() => 0)
          : blended.map((b) => (b / total) * originalExposure);
    }
    return out;
  }

  override toString(): string {
    return `InverseVolModel(lookback=${this.lookback}, mode=${this.blendAlpha ? 'blend' : 'pure'})`;
  }
}
