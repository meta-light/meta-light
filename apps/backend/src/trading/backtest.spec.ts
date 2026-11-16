import { describe, expect, it } from 'vitest';
import { windowStats } from './backtest';

const days = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));

describe('windowStats', () => {
  it('scores full rolling windows counted back from the last bar', () => {
    const dates = days(22);
    const nav = dates.map((_, i) => 100 * 1.01 ** i);
    const s = windowStats(dates, nav, () => 0, 7, 7)!;
    expect(s.windows).toBe(3);
    expect(s.median).toBeCloseTo(1.01 ** 7 - 1, 10);
    expect(s.up).toBe(1);
    expect(s.beatHold).toBe(1);
    expect(s.last).toBeCloseTo(1.01 ** 7 - 1, 10);
  });

  it('compares each window to buy and hold over the same dates', () => {
    const dates = days(15);
    const nav = dates.map(() => 100);
    const hold = (from: string, to: string): number => (to > '2024-01-10' && from < '2024-01-10' ? 0.05 : -0.05);
    const s = windowStats(dates, nav, hold, 7, 7)!;
    expect(s.windows).toBe(2);
    expect(s.beatHold).toBe(0.5);
    expect(s.lastHold).toBe(0.05);
  });

  it('returns null when history is shorter than the horizon', () => {
    expect(windowStats(days(30), Array(30).fill(1), () => 0, 91)).toBeNull();
  });
});
