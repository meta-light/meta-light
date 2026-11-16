import { Frame, isNum } from './frame';

export function averageTrueRange(
  high: Frame,
  low: Frame,
  close: Frame,
  window = 20,
): Frame {
  const prevClose = close.shift(1);
  const trueRange = high.map((h, i, j) => {
    const l = low.values[i]![j]!;
    const pc = prevClose.values[i]![j]!;
    const parts = [h - l, Math.abs(h - pc), Math.abs(l - pc)].filter(isNum);
    return parts.length ? Math.max(...parts) : NaN;
  });
  return trueRange.rollingMean(window);
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function compactDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, '');
}

export function recentPeriod(days = 21): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
