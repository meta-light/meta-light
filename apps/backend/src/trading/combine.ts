export interface ComboScore {
  idx: number[];
  total: number;
  cagr: number;
  maxDrawdown: number;
  calmar: number;
  sortino: number;
}

export type Objective = 'calmar' | 'sortino';

const DAY = 86_400_000;

export function monthStarts(dates: readonly string[]): Uint8Array {
  const out = new Uint8Array(dates.length);
  for (let t = 1; t < dates.length; t++) out[t] = dates[t]!.slice(0, 7) !== dates[t - 1]!.slice(0, 7) ? 1 : 0;
  return out;
}

export function blendNav(
  rets: readonly Float64Array[],
  idx: readonly number[],
  rebal: Uint8Array,
  from: number,
  to: number,
): Float64Array {
  const k = idx.length;
  const s = new Float64Array(k).fill(1 / k);
  const nav = new Float64Array(to - from + 1);
  nav[0] = 1;
  let v = 1;
  for (let t = from + 1; t <= to; t++) {
    if (rebal[t]) for (let j = 0; j < k; j++) s[j] = v / k;
    v = 0;
    for (let j = 0; j < k; j++) {
      s[j]! *= 1 + rets[idx[j]!]![t]!;
      v += s[j]!;
    }
    nav[t - from] = v;
  }
  return nav;
}

export function scoreCombo(
  rets: readonly Float64Array[],
  idx: readonly number[],
  rebal: Uint8Array,
  from: number,
  to: number,
  years: number,
): ComboScore {
  const k = idx.length;
  const s = new Float64Array(k).fill(1 / k);
  let v = 1;
  let peak = 1;
  let dd = 0;
  let sum = 0;
  let down = 0;
  for (let t = from + 1; t <= to; t++) {
    if (rebal[t]) for (let j = 0; j < k; j++) s[j] = v / k;
    const prev = v;
    v = 0;
    for (let j = 0; j < k; j++) {
      s[j]! *= 1 + rets[idx[j]!]![t]!;
      v += s[j]!;
    }
    const r = v / prev - 1;
    sum += r;
    if (r < 0) down += r * r;
    if (v > peak) peak = v;
    else if (v / peak - 1 < dd) dd = v / peak - 1;
  }
  const n = to - from;
  const total = v - 1;
  const cagr = v > 0 ? v ** (1 / years) - 1 : -1;
  const downDev = Math.sqrt(down / n);
  return {
    idx: [...idx],
    total,
    cagr,
    maxDrawdown: dd,
    calmar: dd < 0 ? cagr / -dd : cagr > 0 ? Infinity : 0,
    sortino: downDev > 0 ? ((sum / n) / downDev) * Math.sqrt(365) : 0,
  };
}

export function* combinations(n: number, maxSize: number): Generator<number[]> {
  for (let k = 1; k <= Math.min(maxSize, n); k++) {
    const c = Array.from({ length: k }, (_, i) => i);
    while (true) {
      yield [...c];
      let i = k - 1;
      while (i >= 0 && c[i] === n - k + i) i--;
      if (i < 0) break;
      c[i]!++;
      for (let j = i + 1; j < k; j++) c[j] = c[j - 1]! + 1;
    }
  }
}

export function paretoFrontier(scores: readonly ComboScore[]): ComboScore[] {
  const sorted = [...scores].sort((a, b) => b.maxDrawdown - a.maxDrawdown || b.cagr - a.cagr);
  const out: ComboScore[] = [];
  let best = -Infinity;
  for (const s of sorted)
    if (s.cagr > best) {
      out.push(s);
      best = s.cagr;
    }
  return out;
}

export const yearsBetween = (a: string, b: string): number =>
  (Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / (365.25 * DAY);
