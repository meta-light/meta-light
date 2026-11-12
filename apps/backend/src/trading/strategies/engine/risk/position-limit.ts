// Ported from backtester/risk/position_limit.py (QuantJourney Backtester, Apache 2.0).
//
// Enforces per-instrument caps, an optional per-instrument floor, sector
// limits and a total gross leverage cap. Capped excess is redistributed to
// active instruments with room; inactive instruments never gain exposure.

import { type Frame, isNum } from '../../../../services/trading/strategies/core';
import { RiskModel, type RiskMetadata } from './base';
import { absSum, cloneFrame, sign } from './util';

export interface PositionLimitOptions {
  /** Maximum absolute weight for any single instrument. */
  maxWeight?: number;
  /** Minimum absolute weight for active instruments; 0 disables. */
  minWeight?: number;
  /** Maximum sum of absolute weights. */
  maxTotalLeverage?: number;
  /** Sector name to max aggregate absolute weight. Needs metadata.sectors. */
  sectorLimits?: Record<string, number>;
}

export class PositionLimitModel extends RiskModel {
  readonly maxWeight: number;
  readonly minWeight: number;
  readonly maxTotalLeverage: number;
  readonly sectorLimits: Readonly<Record<string, number>>;

  constructor(opts: PositionLimitOptions = {}) {
    super();
    this.maxWeight = opts.maxWeight ?? 0.4;
    this.minWeight = opts.minWeight ?? 0.0;
    this.maxTotalLeverage = opts.maxTotalLeverage ?? 2.0;
    this.sectorLimits = { ...(opts.sectorLimits ?? {}) };
  }

  adjust(weights: Frame, _returns: Frame, metadata?: RiskMetadata): Frame {
    const out = cloneFrame(weights);
    const sectors =
      Object.keys(this.sectorLimits).length && metadata?.sectors
        ? metadata.sectors
        : null;

    for (let i = 0; i < out.length; i++) {
      let row = out.values[i]!;
      const abs = row.map(Math.abs);
      const rowTotal = absSum(row);
      // Pre-screen: rows that provably satisfy every limit stay untouched.
      const validAbs = abs.filter(isNum);
      const rowMax = validAbs.length ? Math.max(...validAbs) : NaN;
      let needsWork =
        rowTotal >= 1e-10 &&
        (rowMax > this.maxWeight || rowTotal > this.maxTotalLeverage);
      if (this.minWeight > 0)
        needsWork ||= abs.some((a) => a > 1e-10 && a < this.minWeight);
      if (sectors) needsWork ||= rowTotal >= 1e-10;
      if (!needsWork || rowTotal < 1e-10) continue;

      row = this.applyCap(row);
      if (sectors) row = this.applySectorLimits(row, weights.columns, sectors);
      row = this.capLeverage(row);

      if (this.minWeight > 0) {
        row = this.applyFloor(row);
        row = this.applyCap(row);
        row = this.capLeverage(row);
      }
      out.values[i] = row;
    }
    return out;
  }

  private capLeverage(row: number[]): number[] {
    const total = absSum(row);
    return total > this.maxTotalLeverage
      ? row.map((v) => v * (this.maxTotalLeverage / total))
      : row;
  }

  /** Cap each weight at maxWeight, redistributing until no cap is breached. */
  applyCap(row: readonly number[]): number[] {
    const max = this.maxWeight;
    const capped = [...row];
    const active = capped.map((v) => Math.abs(v) > 1e-10);
    const targetAbsTotal = absSum(capped);
    if (targetAbsTotal < 1e-10) return capped;

    for (let it = 0; it < capped.length + 1; it++) {
      const over = capped.map((v) => Math.abs(v) > max + 1e-10);
      if (!over.some(Boolean)) break;
      for (let j = 0; j < capped.length; j++)
        if (over[j]) capped[j] = sign(capped[j]!) * max;

      const excess = targetAbsTotal - absSum(capped);
      if (excess <= 1e-10) break;

      // pandas clip keeps NaN, and NaN > 1e-10 is false.
      const room = capped.map((v) => {
        const r = max - Math.abs(v);
        return Number.isNaN(r) ? NaN : Math.max(r, 0);
      });
      const cand = capped
        .map((_, j) => j)
        .filter((j) => active[j] && room[j]! > 1e-10);
      if (!cand.length) break;

      let wts = cand.map((j) => Math.abs(capped[j]!));
      if (absSum(wts) <= 1e-10) wts = cand.map((j) => room[j]!);
      const wSum = wts.reduce((s, v) => s + (isNum(v) ? v : 0), 0);
      cand.forEach((j, k) => {
        const redist = Math.min((wts[k]! / wSum) * excess, room[j]!);
        const s = capped[j] === 0 ? 1 : sign(capped[j]!);
        capped[j] = capped[j]! + s * redist;
      });
    }
    return capped.map((v) =>
      Number.isNaN(v) ? v : Math.min(Math.max(v, -max), max),
    );
  }

  /** Set active positions below minWeight to minWeight (keeping sign). */
  applyFloor(row: readonly number[]): number[] {
    return row.map((v) => {
      const a = Math.abs(v);
      return a > 1e-10 && a < this.minWeight ? sign(v) * this.minWeight : v;
    });
  }

  /** Scale each over-limit sector down to its limit. */
  applySectorLimits(
    row: readonly number[],
    columns: readonly string[],
    sectors: Record<string, string>,
  ): number[] {
    const out = [...row];
    for (const [sector, limit] of Object.entries(this.sectorLimits)) {
      const mask = columns.map((c) => sectors[c] === sector);
      const total = absSum(out.filter((_, j) => mask[j]));
      if (total > limit) {
        const scale = limit / total;
        for (let j = 0; j < out.length; j++)
          if (mask[j]) out[j] = out[j]! * scale;
      }
    }
    return out;
  }

  override toString(): string {
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const parts = [`max=${pct(this.maxWeight)}`];
    if (this.minWeight > 0) parts.push(`min=${pct(this.minWeight)}`);
    if (this.maxTotalLeverage < 10)
      parts.push(`lev=${this.maxTotalLeverage.toFixed(1)}x`);
    const nSectors = Object.keys(this.sectorLimits).length;
    if (nSectors) parts.push(`sectors=${nSectors}`);
    return `PositionLimitModel(${parts.join(', ')})`;
  }
}
