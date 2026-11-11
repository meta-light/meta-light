// Indicator and sizing helpers shared by more than one template.

import { Frame, isNum } from "./frame";

/** Average true range over `window` bars (simple mean of the true range). */
export function averageTrueRange(high: Frame, low: Frame, close: Frame, window = 20): Frame {
  const prevClose = close.shift(1);
  const trueRange = high.map((h, i, j) => {
    const l = low.values[i]![j]!;
    const pc = prevClose.values[i]![j]!;
    // pandas max over the three components skips NaN (first bar has no prev close).
    const parts = [h - l, Math.abs(h - pc), Math.abs(l - pc)].filter(isNum);
    return parts.length ? Math.max(...parts) : NaN;
  });
  return trueRange.rollingMean(window);
}

/** Round to cents, like Python's `round(x, 2)` for prices. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** `YYYY-MM-DD` -> `YYYYMMDD`, for building order ids. */
export function compactDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, "");
}

/** A `{start, end}` window ending today (UTC), for intraday templates. */
export function recentPeriod(days = 21): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
