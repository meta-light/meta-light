// Ported from backtester/risk/base.py (QuantJourney Backtester, Apache 2.0).
// Shared pandas-equivalent helpers used by the risk models (NaN-skipping sums, std, rescore dates).

import { Frame, isNum } from "../../core";

/** Deep copy of a frame's values. */
export function cloneFrame(f: Frame): Frame {
  return new Frame(f.index, f.columns, f.values.map((r) => [...r]));
}

/** pandas Series.sum() of absolute values: NaN skipped, empty = 0. */
export function absSum(xs: readonly number[]): number {
  let s = 0;
  for (const v of xs) if (isNum(v)) s += Math.abs(v);
  return s;
}

/** pandas Series.std() (ddof=1, NaN skipped). */
export function nanStd(xs: readonly number[]): number {
  const v = xs.filter(isNum);
  if (v.length < 2) return NaN;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** np.sign, with NaN passing through. */
export const sign = (v: number): number => (Number.isNaN(v) ? NaN : v > 0 ? 1 : v < 0 ? -1 : 0);

/** Annualisation factor: explicit value, else sqrt(periodsPerYear), default 252. */
export function annFactorFor(annFactor: number | null | undefined, periodsPerYear: number | undefined): number {
  if (annFactor !== null && annFactor !== undefined) return annFactor;
  return Math.sqrt(Math.max(Math.trunc(periodsPerYear ?? 252), 1));
}

function parseDate(d: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) throw new Error(`Unparseable date in risk model index: ${d}`);
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
}

/** pandas `index.to_period(code)` key for M, Q and W (W-SUN: Monday to Sunday weeks). */
function periodKey(date: string, code: "M" | "Q" | "W"): string {
  const d = parseDate(date);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  if (code === "M") return `${y}-${mo}`;
  if (code === "Q") return `${y}-Q${Math.floor(mo / 3)}`;
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - daysSinceMonday * 86_400_000).toISOString().slice(0, 10);
}

const FREQ_TO_PERIOD: Record<string, "M" | "Q" | "W"> = { BMS: "M", "W-MON": "W", MS: "M", QS: "Q" };

/**
 * Rows where a model recomputes its scale or weights: every row for "D",
 * otherwise the first row of each calendar period (unknown codes = monthly).
 */
export function rescoreMask(index: readonly string[], rebalanceFreq: string): boolean[] {
  if (rebalanceFreq === "D") return index.map(() => true);
  const code = FREQ_TO_PERIOD[rebalanceFreq] ?? "M";
  const keys = index.map((d) => periodKey(d, code));
  return keys.map((k, i) => i === 0 || k !== keys[i - 1]);
}
