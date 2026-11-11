// Ported from backtester/risk/vol_target.py (QuantJourney Backtester, Apache 2.0).
//
// Scales ALL weights by one scalar so the portfolio's realised volatility
// matches a target. The common institutional vol-targeting overlay.

import type { Frame } from "../../core";
import { RiskModel, type RiskMetadata } from "./base";
import { absSum, annFactorFor, cloneFrame, nanStd, rescoreMask } from "./util";

export interface VolTargetOptions {
  /** Annualised target vol, e.g. 0.15. */
  targetVol?: number;
  /** Rolling window (bars) for the realised vol estimate. */
  lookback?: number;
  /** Hard cap on the scale factor. */
  maxLeverage?: number;
  /** When to recompute the scale: "BMS" (default, monthly), "D", "W-MON", "MS", "QS". */
  rebalanceFreq?: string;
  /** Annualisation factor; defaults to sqrt(periodsPerYear). */
  annFactor?: number | null;
}

export class VolTargetModel extends RiskModel {
  readonly targetVol: number;
  readonly lookback: number;
  readonly maxLeverage: number;
  readonly rebalanceFreq: string;
  readonly annFactor: number | null;

  constructor(opts: VolTargetOptions = {}) {
    super();
    this.targetVol = opts.targetVol ?? 0.15;
    this.lookback = opts.lookback ?? 63;
    this.maxLeverage = opts.maxLeverage ?? 2.0;
    this.rebalanceFreq = opts.rebalanceFreq ?? "BMS";
    this.annFactor = opts.annFactor ?? null;
  }

  adjust(weights: Frame, returns: Frame, metadata?: RiskMetadata): Frame {
    const n = weights.length;
    if (n === 0) return weights;

    const out = cloneFrame(weights);
    const ann = annFactorFor(this.annFactor, metadata?.periodsPerYear);
    const isRescore = rescoreMask(weights.index, this.rebalanceFreq);
    // Align return columns to the weight columns by name.
    const retCols = weights.columns.map((c) => returns.colIndex(c));

    let prevScale = 1.0;
    for (let i = this.lookback; i < n; i++) {
      const rowW = weights.values[i]!;
      const totalW = absSum(rowW);
      if (totalW < 1e-8) {
        out.values[i] = rowW.map(() => 0);
        continue;
      }
      const normW = rowW.map((w) => w / totalW);

      if (isRescore[i]) {
        const portRets: number[] = [];
        for (let k = Math.max(0, i - this.lookback); k < i; k++) {
          const r = returns.values[k]!;
          // pandas row sum skips NaN; an all-NaN row sums to 0.
          let s = 0;
          for (let j = 0; j < normW.length; j++) {
            const v = (retCols[j]! >= 0 ? r[retCols[j]!]! : NaN) * normW[j]!;
            if (!Number.isNaN(v)) s += v;
          }
          portRets.push(s);
        }
        const realisedVol = nanStd(portRets) * ann;
        prevScale = realisedVol > 0.01 ? Math.min(this.targetVol / realisedVol, this.maxLeverage) : 1.0;
      }

      out.values[i] = rowW.map((w) => w * prevScale);
    }
    return out;
  }

  override toString(): string {
    return `VolTargetModel(target=${Math.round(this.targetVol * 100)}%, lookback=${this.lookback}, max_lev=${this.maxLeverage})`;
  }
}
