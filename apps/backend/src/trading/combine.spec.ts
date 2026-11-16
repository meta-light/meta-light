import { describe, expect, it } from 'vitest';
import { blendNav, combinations, monthStarts, paretoFrontier, scoreCombo, type ComboScore } from './combine';

const f = (xs: number[]): Float64Array => Float64Array.from(xs);

describe('combinations', () => {
  it('lists every subset of size 1..k once', () => {
    const all = [...combinations(4, 2)].map((c) => c.join(''));
    expect(all).toEqual(['0', '1', '2', '3', '01', '02', '03', '12', '13', '23']);
    let n = 0;
    for (const _ of combinations(10, 4)) n++;
    expect(n).toBe(10 + 45 + 120 + 210);
  });
});

describe('monthStarts', () => {
  it('flags the first bar of each new month', () => {
    expect([...monthStarts(['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02'])]).toEqual([0, 0, 1, 0]);
  });
});

describe('blendNav / scoreCombo', () => {
  const rets = [f([0, 1, 0, 0]), f([0, -0.5, 0, 0])];

  it('lets sleeves drift until a rebalance', () => {
    const nav = blendNav(rets, [0, 1], new Uint8Array(4), 0, 3);
    expect([...nav]).toEqual([1, 1.25, 1.25, 1.25]);
  });

  it('resets to equal weight on rebalance bars', () => {
    const r = [f([0, 1, 0.1, 0]), f([0, -0.5, -0.1, 0])];
    const nav = blendNav(r, [0, 1], Uint8Array.from([0, 0, 1, 0]), 0, 3);
    expect(nav[2]).toBeCloseTo(1.25, 12);
  });

  it('scores the same path blendNav builds', () => {
    const r = [f([0, 0.1, -0.2, 0.3]), f([0, -0.05, 0.02, 0.01])];
    const nav = blendNav(r, [0, 1], new Uint8Array(4), 0, 3);
    const sc = scoreCombo(r, [0, 1], new Uint8Array(4), 0, 3, 1);
    expect(sc.total).toBeCloseTo(nav[3]! - 1, 12);
    const peak = Math.max(nav[0]!, nav[1]!);
    expect(sc.maxDrawdown).toBeCloseTo(Math.min(0, nav[2]! / peak - 1, nav[3]! / Math.max(peak, nav[2]!) - 1), 12);
  });

  it('scores a sub-range starting at NAV 1', () => {
    const sc = scoreCombo(rets, [0], new Uint8Array(4), 1, 3, 1);
    expect(sc.total).toBe(0);
  });
});

describe('paretoFrontier', () => {
  it('keeps only combos not beaten on both CAGR and drawdown', () => {
    const mk = (cagr: number, dd: number): ComboScore => ({ idx: [], total: 0, cagr, maxDrawdown: dd, calmar: 0, sortino: 0 });
    const a = mk(0.1, -0.05);
    const b = mk(0.3, -0.2);
    const c = mk(0.2, -0.3);
    const d = mk(0.05, -0.1);
    expect(paretoFrontier([a, b, c, d])).toEqual([a, b]);
  });
});
