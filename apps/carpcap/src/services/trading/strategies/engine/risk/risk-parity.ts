// Ported from backtester/risk/risk_parity.py (QuantJourney Backtester, Apache 2.0).
//
// Equal Risk Contribution (ERC): each active instrument contributes the same
// share of portfolio variance. Uses the strategy's weights only to pick the
// active set and the sign of each position; magnitudes are re-derived from
// the trailing covariance. Original gross exposure is preserved.

import { type Frame, isNum } from "../../core";
import { RiskModel, type RiskMetadata } from "./base";
import { absSum, cloneFrame, rescoreMask, sign } from "./util";

export interface RiskParityOptions {
  /** Rolling window (bars) for covariance estimation. Must be >= 2. */
  lookback?: number;
  /** Maximum iterations for the ERC solver. */
  maxIter?: number;
  /** Convergence tolerance on weight change. */
  tol?: number;
  /** When to recompute: "BMS" (default, monthly), "D", "W-MON", "MS", "QS". */
  rebalanceFreq?: string;
}

/**
 * pandas DataFrame.cov() with ddof=1. With no NaN it follows np.cov (two-pass
 * means); otherwise it follows pandas' nancorr (Welford over pairwise-complete
 * observations, NaN when a pair has fewer than two).
 */
export function pairwiseCov(cols: readonly (readonly number[])[]): number[][] {
  const k = cols.length;
  const rows = k ? cols[0]!.length : 0;
  const out = Array.from({ length: k }, () => new Array<number>(k).fill(NaN));

  if (cols.every((c) => c.every(isNum))) {
    if (rows < 2) return out;
    const centred = cols.map((c) => {
      const m = c.reduce((s, v) => s + v, 0) / rows;
      return c.map((v) => v - m);
    });
    for (let a = 0; a < k; a++) {
      for (let b = a; b < k; b++) {
        let acc = 0;
        for (let t = 0; t < rows; t++) acc += centred[a]![t]! * centred[b]![t]!;
        out[a]![b] = out[b]![a] = acc / (rows - 1);
      }
    }
    return out;
  }

  for (let a = 0; a < k; a++) {
    for (let b = 0; b <= a; b++) {
      const xs = cols[a]!;
      const ys = cols[b]!;
      let nobs = 0;
      let meanx = 0;
      let meany = 0;
      let covxy = 0;
      for (let t = 0; t < rows; t++) {
        const vx = xs[t]!;
        const vy = ys[t]!;
        if (!isNum(vx) || !isNum(vy)) continue;
        nobs += 1;
        const dx = vx - meanx;
        const dy = vy - meany;
        meanx += (1 / nobs) * dx;
        meany += (1 / nobs) * dy;
        covxy += (vx - meanx) * dy;
      }
      out[a]![b] = out[b]![a] = nobs < 2 ? NaN : covxy / (nobs - 1);
    }
  }
  return out;
}

const plainSum = (xs: readonly number[]): number => xs.reduce((s, v) => s + v, 0);

export class RiskParityModel extends RiskModel {
  readonly lookback: number;
  readonly maxIter: number;
  readonly tol: number;
  readonly rebalanceFreq: string;

  constructor(opts: RiskParityOptions = {}) {
    super();
    this.lookback = opts.lookback ?? 63;
    this.maxIter = opts.maxIter ?? 50;
    this.tol = opts.tol ?? 1e-8;
    this.rebalanceFreq = opts.rebalanceFreq ?? "BMS";
    if (this.lookback < 2) throw new Error("lookback must be at least 2");
    if (this.maxIter < 1) throw new Error("maxIter must be positive");
    if (!(this.tol > 0)) throw new Error("tol must be positive");
  }

  adjust(weights: Frame, returns: Frame, _metadata?: RiskMetadata): Frame {
    const n = weights.length;
    if (n === 0) return weights;

    const out = cloneFrame(weights);
    const isRescore = rescoreMask(weights.index, this.rebalanceFreq);
    let prevRp: number[] | null = null;
    let prevSignature: number[] | null = null;

    for (let i = this.lookback; i < n; i++) {
      const rowW = weights.values[i]!;
      const active = rowW.map((w) => Math.abs(w) > 1e-10);
      const nActive = active.filter(Boolean).length;
      const signature = rowW.map(sign);

      if (nActive < 2) {
        out.values[i] = [...rowW];
        prevRp = null;
        prevSignature = signature;
        continue;
      }

      // Python compares sign tuples; NaN never equals NaN, so any NaN forces a recompute.
      const sameSignature =
        prevSignature !== null && prevSignature.length === signature.length && signature.every((s, j) => s === prevSignature![j]);

      if (isRescore[i] || prevRp === null || !sameSignature) {
        const from = Math.max(0, i - this.lookback);
        const activeIdx = weights.columns.map((_, j) => j).filter((j) => active[j]);
        const signs = activeIdx.map((j) => sign(rowW[j]!));
        // ERC solves for positive magnitudes: flip each series by its sign, then restore.
        const subCols = activeIdx.map((j, a) => {
          const name = weights.columns[j]!;
          const rj = returns.colIndex(name);
          if (rj < 0) throw new Error(`returns missing column ${name}`);
          const col: number[] = [];
          for (let t = from; t < i; t++) col.push(returns.values[t]![rj]! * signs[a]!);
          return col;
        });
        const rpW = this.solveErc(pairwiseCov(subCols), nActive);
        const exposure = absSum(rowW);
        const full = new Array<number>(rowW.length).fill(0);
        activeIdx.forEach((j, a) => {
          full[j] = signs[a]! * rpW[a]! * exposure;
        });
        prevRp = full;
        prevSignature = signature;
      }

      out.values[i] = [...prevRp!];
    }
    return out;
  }

  /** Iterative ERC solver. Returns positive weights summing to 1. */
  solveErc(cov: number[][], n: number): number[] {
    // Start from inverse vol. Math.max propagates NaN like np.maximum.
    let w = cov.map((r, k) => 1 / Math.sqrt(Math.max(r[k]!, 1e-12)));
    const s0 = plainSum(w);
    w = w.map((v) => v / s0);

    for (let it = 0; it < this.maxIter; it++) {
      const sigmaW = cov.map((r) => r.reduce((s, c, k) => s + c * w[k]!, 0));
      const mrc = w.map((v, k) => v * sigmaW[k]!);
      const totalRisk = plainSum(mrc);
      if (totalRisk < 1e-16) return new Array<number>(n).fill(1 / n);

      const targetRc = totalRisk / n;
      let wNew = w.map((v, k) => Math.max(v * (mrc[k]! > 1e-16 ? targetRc / mrc[k]! : 1), 1e-10));
      const s = plainSum(wNew);
      wNew = wNew.map((v) => v / s);

      if (Math.max(...wNew.map((v, k) => Math.abs(v - w[k]!))) < this.tol) return wNew;
      w = wNew;
    }
    return w;
  }

  override toString(): string {
    return `RiskParityModel(lookback=${this.lookback}, freq=${this.rebalanceFreq})`;
  }
}
