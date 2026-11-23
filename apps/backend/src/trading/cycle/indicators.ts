import { sma } from '../strategies/engine/data';

/** Bars since the running maximum was set; NaN until the first finite price. */
export function daysSinceHigh(prices: readonly number[]): number[] {
  let high = -Infinity;
  let at = -1;
  return prices.map((p, i) => {
    if (Number.isFinite(p) && p >= high) {
      high = p;
      at = i;
    }
    return at < 0 ? NaN : i - at;
  });
}

/** Miner revenue over its own trailing mean; low values mean miners earn below their usual cost base. */
export function puellMultiple(revenue: readonly number[], window = 365): number[] {
  const avg = sma(revenue, window);
  return revenue.map((v, i) => v / avg[i]!);
}

export function rollingCorr(a: readonly number[], b: readonly number[], window: number): number[] {
  return a.map((_, i) => {
    if (i + 1 < window) return NaN;
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let k = i - window + 1; k <= i; k++) {
      const x = a[k]!;
      const y = b[k]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      n++;
      sa += x;
      sb += y;
      saa += x * x;
      sbb += y * y;
      sab += x * y;
    }
    if (n < window) return NaN;
    const cov = sab - (sa * sb) / n;
    const den = Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
    return den > 0 ? cov / den : NaN;
  });
}

/**
 * Accumulate-until-exit: exposure ratchets up to the deepest entry tier seen and is held
 * (not trimmed as price recovers) until the exit condition fires.
 */
export function holdUntil(entry: readonly number[], exit: readonly boolean[]): number[] {
  let pos = 0;
  return entry.map((e, i) => (pos = exit[i] ? 0 : Math.max(pos, Number.isFinite(e) ? e : 0)));
}
