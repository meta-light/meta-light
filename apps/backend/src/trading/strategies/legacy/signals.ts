// The old functions scored only the last bar of a price history. Here each
// function returns the score and strength for every bar t, using only bars
// 0..t, so the value at bar t equals the old function called on
// `history.slice(0, t + 1)` (the parity spec checks this).
//
// Bars where the old code would have returned "not enough history" are NaN,
// so a strategy stays flat there.
//
// Deviations from the old code, all deliberate:
// - Stochastic and ADX take real high/low. The old code was fed close only.
//   Passing the close series as high and low reproduces the old stochastic.
// - ADX uses standard Wilder smoothing. The old version re-averaged a
//   14-bar SMA each step and ended with ADX == DX.
// - RSI on a perfectly flat window is 50, not 100 (engine kernel).
// - Liquidity-based uses the old price-volatility fallback only. OHLCV bars
//   carry no spread or pool-liquidity history.

import { ema, rsi, sma } from '../engine/data';

/** Score in [-1, 1] (sign = direction) and strength in [0, 1], per bar. */
export interface LegacyScore {
  score: number[];
  strength: number[];
}

export interface LegacySignalSpec {
  name: LegacySignalName;
  threshold: number;
  weight: number;
}

export type LegacySignalName =
  | 'SMA_Crossover'
  | 'EMA_Crossover'
  | 'RSI_Oversold_Overbought'
  | 'MACD_Signal'
  | 'Bollinger_Bands'
  | 'Stochastic_Oscillator'
  | 'ADX_Trend'
  | 'Combined_Momentum'
  | 'Pattern_Recognition'
  | 'Mean_Reversion'
  | 'Liquidity_Based';

/** `SIGNAL_CONFIG` from the old config.ts (identical for every chain). */
export const LEGACY_SIGNALS: Record<LegacySignalName, LegacySignalSpec> = {
  SMA_Crossover: { name: 'SMA_Crossover', threshold: 0.5, weight: 1.0 },
  EMA_Crossover: { name: 'EMA_Crossover', threshold: 0.5, weight: 1.1 },
  RSI_Oversold_Overbought: {
    name: 'RSI_Oversold_Overbought',
    threshold: 0.55,
    weight: 1.2,
  },
  MACD_Signal: { name: 'MACD_Signal', threshold: 0.5, weight: 1.2 },
  Bollinger_Bands: { name: 'Bollinger_Bands', threshold: 0.55, weight: 1.0 },
  Stochastic_Oscillator: {
    name: 'Stochastic_Oscillator',
    threshold: 0.6,
    weight: 0.9,
  },
  ADX_Trend: { name: 'ADX_Trend', threshold: 0.55, weight: 1.1 },
  Combined_Momentum: {
    name: 'Combined_Momentum',
    threshold: 0.55,
    weight: 1.2,
  },
  Pattern_Recognition: {
    name: 'Pattern_Recognition',
    threshold: 0.5,
    weight: 0.8,
  },
  Mean_Reversion: { name: 'Mean_Reversion', threshold: 0.45, weight: 0.9 },
  Liquidity_Based: { name: 'Liquidity_Based', threshold: 0.5, weight: 1.4 },
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const nanArray = (n: number): number[] => new Array<number>(n).fill(NaN);

function emptyScore(n: number): LegacyScore {
  return { score: nanArray(n), strength: nanArray(n) };
}

/**
 * Run `fn` on the part of each series after its leading NaNs and pad the
 * front back with NaN. Multi-asset frames hold leading NaNs for instruments
 * that list later than others; the engine kernels would otherwise give NaN
 * for the whole column.
 */
function afterLeadingNaN(
  series: readonly (readonly number[])[],
  fn: (...xs: number[][]) => LegacyScore,
): LegacyScore {
  const n = series[0]!.length;
  let start = 0;
  while (start < n && series.some((xs) => Number.isNaN(xs[start]!))) start++;
  if (start === 0) return fn(...series.map((xs) => [...xs]));
  const inner = fn(...series.map((xs) => xs.slice(start)));
  const pad = nanArray(start);
  return {
    score: [...pad, ...inner.score],
    strength: [...pad, ...inner.strength],
  };
}

function crossoverScore(
  close: readonly number[],
  fast: readonly number[],
  slow: readonly number[],
): LegacyScore {
  const out = emptyScore(close.length);
  close.forEach((p, t) => {
    const f = fast[t]!;
    const s = slow[t]!;
    if (Number.isNaN(f) || Number.isNaN(s)) return;
    const d = (p - f) / f;
    if (f > s) out.score[t] = clamp(d * 10, 0, 1);
    else if (f < s) out.score[t] = clamp(d * 10, -1, 0);
    else {
      out.score[t] = 0;
      out.strength[t] = 0;
      return;
    }
    out.strength[t] = Math.min(Math.abs(d) * 10, 1);
  });
  return out;
}

export function smaCrossoverScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) =>
    crossoverScore(c, sma(c, 20), sma(c, 50)),
  );
}

export function emaCrossoverScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) =>
    crossoverScore(c, ema(c, 12), ema(c, 26)),
  );
}

export function meanReversionScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const mid = sma(c, 20);
    const out = emptyScore(c.length);
    c.forEach((p, t) => {
      const m = mid[t]!;
      if (Number.isNaN(m)) return;
      const dev = (p - m) / m;
      if (dev < -0.05) {
        out.score[t] = clamp(Math.abs(dev) * 10, 0, 1);
        out.strength[t] = Math.min(Math.abs(dev) * 10, 1);
      } else if (dev > 0.05) {
        out.score[t] = clamp(-dev * 10, -1, 0);
        out.strength[t] = Math.min(dev * 10, 1);
      } else {
        out.score[t] = 0;
        out.strength[t] = 0;
      }
    });
    return out;
  });
}

export function rsiScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const r = rsi(c, 14);
    const out = emptyScore(c.length);
    r.forEach((v, t) => {
      // The old `if (!rsi)` also skipped RSI == 0.
      if (Number.isNaN(v) || v === 0) {
        if (v === 0) {
          out.score[t] = 0;
          out.strength[t] = 0;
        }
        return;
      }
      if (v < 30) {
        out.score[t] = clamp((30 - v) / 30, 0, 1);
        out.strength[t] = (30 - v) / 30;
      } else if (v > 70) {
        out.score[t] = clamp(-(v - 70) / 30, -1, 0);
        out.strength[t] = (v - 70) / 30;
      } else {
        const n = (v - 50) / 50;
        out.score[t] = clamp(n, -0.3, 0.3);
        out.strength[t] = Math.abs(n) * 0.5;
      }
    });
    return out;
  });
}

export function stochasticScore(
  close: readonly number[],
  high: readonly number[] = close,
  low: readonly number[] = close,
): LegacyScore {
  return afterLeadingNaN([close, high, low], (c, h, l) => {
    const period = 14;
    const rawK = nanArray(c.length);
    for (let t = period - 1; t < c.length; t++) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let k = t - period + 1; k <= t; k++) {
        hi = Math.max(hi, h[k]!);
        lo = Math.min(lo, l[k]!);
      }
      rawK[t] = hi === lo ? 50 : (100 * (c[t]! - lo)) / (hi - lo);
    }
    const kLine = sma(rawK, 3);
    const dLine = sma(kLine, 3);
    const out = emptyScore(c.length);
    c.forEach((_, t) => {
      const k = kLine[t]!;
      const d = dLine[t]!;
      if (Number.isNaN(k) || Number.isNaN(d)) return;
      if (k < 20 && d < 20 && k > d) {
        out.score[t] = clamp((20 - k) / 20, 0, 1);
        out.strength[t] = (20 - k) / 20;
      } else if (k > 80 && d > 80 && k < d) {
        out.score[t] = clamp(-(k - 80) / 20, -1, 0);
        out.strength[t] = (k - 80) / 20;
      } else {
        const avg = ((k - 50) / 50 + (d - 50) / 50) / 2;
        out.score[t] = clamp(avg, -0.3, 0.3);
        out.strength[t] = Math.abs(avg) * 0.5;
      }
    });
    return out;
  });
}

/**
 * Old `generateMACDSignal` (12, 26, 9). The old signal line was an EMA(9)
 * over only the last 10 MACD values, i.e. seeded with the mean of the 9
 * values before bar t and stepped once with bar t. Reproduced as-is.
 */
export function macdScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const fast = ema(c, 12);
    const slow = ema(c, 26);
    const line = c.map((_, t) => fast[t]! - slow[t]!);
    const k = 2 / (9 + 1);
    const out = emptyScore(c.length);
    for (let t = 26 + 9 - 1; t < c.length; t++) {
      let seed = 0;
      for (let j = t - 9; j < t; j++) seed += line[j]!;
      seed /= 9;
      const m = line[t]!;
      const signal = m * k + seed * (1 - k);
      const hist = m - signal;
      const denom = Math.max(Math.abs(m), 0.001);
      const rel = (m - signal) / denom;
      const histRel = Math.abs(hist) / denom;
      if (m > signal && hist > 0) {
        out.score[t] = clamp(rel * 50, 0, 1);
        out.strength[t] = Math.min(histRel * 10, 1);
      } else if (m < signal && hist < 0) {
        out.score[t] = clamp(rel * 50, -1, 0);
        out.strength[t] = Math.min(histRel * 10, 1);
      } else {
        out.score[t] = clamp(rel * 20, -0.4, 0.4);
        out.strength[t] = Math.min(histRel * 5, 0.5);
      }
    }
    return out;
  });
}

/** Old `generateBollingerSignal` (20, 2), population standard deviation. */
export function bollingerScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const period = 20;
    const out = emptyScore(c.length);
    for (let t = period - 1; t < c.length; t++) {
      const win = c.slice(t - period + 1, t + 1);
      const mid = win.reduce((s, v) => s + v, 0) / period;
      const sd = Math.sqrt(win.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
      const upper = mid + 2 * sd;
      const lower = mid - 2 * sd;
      const p = c[t]!;
      const pb = (p - lower) / (upper - lower);
      if (p < lower && pb < 0) {
        out.score[t] = clamp(Math.abs(pb), 0, 1);
        out.strength[t] = Math.min(Math.abs(pb), 1);
      } else if (p > upper && pb > 1) {
        out.score[t] = clamp(-(pb - 1), -1, 0);
        out.strength[t] = Math.min(pb - 1, 1);
      } else {
        // A flat window gives pb = NaN; the old code produced NaN here too.
        const bp = (pb - 0.5) * 2;
        out.score[t] = clamp(bp, -0.3, 0.3);
        out.strength[t] = Math.abs(bp) * 0.5;
      }
    }
    return out;
  });
}

/**
 * ADX(14) trend signal with standard Wilder smoothing and real high/low.
 * Scoring is the old `generateADXSignal`: above ADX 25, direction from DI+
 * vs DI-, magnitude from ADX/50 times the DI spread.
 */
export function adxScore(
  close: readonly number[],
  high: readonly number[] = close,
  low: readonly number[] = close,
): LegacyScore {
  return afterLeadingNaN([close, high, low], (c, h, l) => {
    const period = 14;
    const n = c.length;
    const out = emptyScore(n);
    if (n < 2 * period) return out;
    let sTR = 0;
    let sPlus = 0;
    let sMinus = 0;
    let dxSum = 0;
    let adx = NaN;
    for (let t = 1; t < n; t++) {
      const tr = Math.max(
        h[t]! - l[t]!,
        Math.abs(h[t]! - c[t - 1]!),
        Math.abs(l[t]! - c[t - 1]!),
      );
      const up = h[t]! - h[t - 1]!;
      const down = l[t - 1]! - l[t]!;
      const dmPlus = up > down && up > 0 ? up : 0;
      const dmMinus = down > up && down > 0 ? down : 0;
      if (t <= period) {
        sTR += tr;
        sPlus += dmPlus;
        sMinus += dmMinus;
        if (t < period) continue;
      } else {
        sTR = sTR - sTR / period + tr;
        sPlus = sPlus - sPlus / period + dmPlus;
        sMinus = sMinus - sMinus / period + dmMinus;
      }
      const diPlus = sTR > 0 ? (100 * sPlus) / sTR : 0;
      const diMinus = sTR > 0 ? (100 * sMinus) / sTR : 0;
      const diSum = diPlus + diMinus;
      const dx = diSum > 0 ? (100 * Math.abs(diPlus - diMinus)) / diSum : 0;
      // DX is available from t = period; ADX averages the first `period` DX.
      const k = t - period + 1;
      if (k < period) {
        dxSum += dx;
        continue;
      }
      adx = k === period ? (dxSum + dx) / period : (adx * (period - 1) + dx) / period;

      const trendStrength = Math.min(adx / 50, 1);
      const diff = diPlus - diMinus;
      if (adx > 25) {
        if (diPlus > diMinus) {
          out.score[t] = clamp(trendStrength * (diff / 100), 0, 1);
          out.strength[t] = trendStrength;
        } else if (diMinus > diPlus) {
          out.score[t] = clamp(-trendStrength * (Math.abs(diff) / 100), -1, 0);
          out.strength[t] = trendStrength;
        } else {
          out.score[t] = 0;
          out.strength[t] = trendStrength * 0.5;
        }
      } else {
        const weak = diff / 100;
        out.score[t] = clamp(weak * 0.3, -0.3, 0.3);
        out.strength[t] = Math.abs(weak) * 0.3;
      }
    }
    return out;
  });
}

export function patternScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const out = emptyScore(c.length);
    for (let t = 0; t < c.length; t++) {
      if (t < 4) {
        // The old function returned no patterns (score 0) under 5 prices.
        out.score[t] = 0;
        out.strength[t] = 0;
        continue;
      }
      const r = c.slice(t - 4, t + 1);
      const last = r[4]!;
      const prev = r[3]!;
      const prev2 = r[2]!;
      let bull = 0;
      let bear = 0;
      if (
        prev < prev2 &&
        last > prev &&
        last > prev2 &&
        last - prev > prev2 - prev
      )
        bull++;
      if (
        prev > prev2 &&
        last < prev &&
        last < prev2 &&
        prev - last > prev - prev2
      )
        bear++;
      if (r[0]! > r[1]! && r[1]! > r[2]! && r[2]! < r[3]! && r[3]! < r[4]!)
        bull++;
      if (r[0]! < r[1]! && r[1]! < r[2]! && r[2]! > r[3]! && r[3]! > r[4]!)
        bear++;
      if (Math.abs(last - prev) / prev < 0.001) {
        if (prev < prev2) bull++;
        else bear++;
      }
      const total = bull + bear;
      out.score[t] = total === 0 ? 0 : ((bull - bear) / total) * 0.6;
      out.strength[t] = total === 0 ? 0 : Math.min(total / 5, 1) * 0.6;
    }
    return out;
  });
}

/**
 * Old `generateLiquidityBasedSignal`, fallback branch: the mean absolute
 * return over the last 9 moves maps to a 0..100 "liquidity" score. Calm
 * (score > 70, i.e. under 3% average move) buys, wild (under 30, over 7%)
 * sells.
 */
export function liquidityScore(close: readonly number[]): LegacyScore {
  return afterLeadingNaN([close], (c) => {
    const out = emptyScore(c.length);
    for (let t = 9; t < c.length; t++) {
      let total = 0;
      for (let k = t - 8; k <= t; k++) total += Math.abs((c[k]! - c[k - 1]!) / c[k - 1]!);
      const vol = total / 9;
      const liq = clamp(100 - vol * 1000, 0, 100);
      if (liq < 30) {
        out.score[t] = -0.6;
        out.strength[t] = 0.6;
      } else if (liq > 70) {
        out.score[t] = 0.5;
        out.strength[t] = 0.5;
      } else {
        out.score[t] = 0;
        out.strength[t] = 0;
      }
    }
    return out;
  });
}

/** Old "not enough history" result: the aggregators treat it as 0 / 0. */
const orZero = (v: number): number => (Number.isNaN(v) ? 0 : v);

export function combinedMomentumScore(
  close: readonly number[],
  high: readonly number[] = close,
  low: readonly number[] = close,
): LegacyScore {
  const parts = [
    rsiScore(close),
    macdScore(close),
    stochasticScore(close, high, low),
  ];
  const out = emptyScore(close.length);
  close.forEach((p, t) => {
    if (Number.isNaN(p)) return;
    const sigs = parts.map((s) => ({
      score: orZero(s.score[t]!),
      strength: orZero(s.strength[t]!),
    }));
    const avg = (xs: typeof sigs, key: 'score' | 'strength') =>
      xs.reduce((s, x) => s + x[key], 0) / xs.length;
    const buys = sigs.filter((s) => s.score > 0.1);
    const sells = sigs.filter((s) => s.score < -0.1);
    if (buys.length >= 2) {
      out.score[t] = clamp(avg(buys, 'score'), 0, 1);
      out.strength[t] = avg(buys, 'strength');
    } else if (sells.length >= 2) {
      out.score[t] = clamp(avg(sells, 'score'), -1, 0);
      out.strength[t] = avg(sells, 'strength');
    } else {
      out.score[t] = clamp(avg(sigs, 'score') * 0.5, -0.3, 0.3);
      out.strength[t] = avg(sigs, 'strength') * 0.5;
    }
  });
  return out;
}

type Regime = 'trending' | 'sideways' | 'volatile';

function marketCondition(
  c: readonly number[],
  t: number,
): { type: Regime; volatility: number } {
  if (t < 19) return { type: 'sideways', volatility: 0.5 };
  let sq = 0;
  for (let k = t - 18; k <= t; k++) sq += ((c[k]! - c[k - 1]!) / c[k - 1]!) ** 2;
  const volatility = Math.sqrt(sq / 19);
  let recent = 0;
  let older = 0;
  for (let k = t - 9; k <= t; k++) recent += c[k]!;
  for (let k = t - 19; k <= t - 10; k++) older += c[k]!;
  const trend = (recent / 10 - older / 10) / (older / 10);
  if (volatility > 0.05) return { type: 'volatile', volatility };
  if (Math.abs(trend) > 0.02) return { type: 'trending', volatility };
  return { type: 'sideways', volatility };
}

/** Old `regimeWeights` (matches on the signal name, like the original). */
function regimeWeight(type: Regime, s: string): number {
  if (type === 'trending') {
    if (/ADX|EMA|MACD|Momentum/.test(s)) return 1.4;
    if (s.includes('SMA')) return 1.2;
    if (/Bollinger|Mean_Reversion/.test(s)) return 0.7;
    return 1.0;
  }
  if (type === 'sideways') {
    if (/Mean_Reversion|Bollinger/.test(s)) return 1.4;
    if (/Momentum|ADX/.test(s)) return 0.7;
    return 1.0;
  }
  return /Liquidity|RSI|Stochastic/.test(s) ? 1.2 : 0.9;
}

function weightedMedian(xs: { value: number; weight: number }[]): number {
  const sorted = xs
    .filter((v) => Number.isFinite(v.value) && Number.isFinite(v.weight) && v.weight > 0)
    .sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return 0;
  let cum = 0;
  for (const v of sorted) {
    cum += v.weight;
    if (cum >= total / 2) return v.value;
  }
  return sorted[sorted.length - 1]!.value;
}

export interface ConfluenceScore extends LegacyScore {
  /** Fraction of signals whose strength met their threshold. */
  confidence: number[];
  /** Any component signal with |score| > 0.1. */
  aligned: boolean[];
}

const VOLATILITY_PENALTY = 0.5;
const LIQUIDITY_BONUS = 0.1;
const ALIGNMENT_BONUS = 0.1;
const MIN_CONFLUENCE = 2;
/** `calculateLiquidityScore` with no pool-liquidity history. */
const DEFAULT_LIQUIDITY = 0.5;

export function confluenceScore(
  close: readonly number[],
  high: readonly number[] = close,
  low: readonly number[] = close,
): ConfluenceScore {
  const parts: [LegacySignalSpec, LegacyScore][] = [
    [LEGACY_SIGNALS.SMA_Crossover, smaCrossoverScore(close)],
    [LEGACY_SIGNALS.EMA_Crossover, emaCrossoverScore(close)],
    [LEGACY_SIGNALS.RSI_Oversold_Overbought, rsiScore(close)],
    [LEGACY_SIGNALS.MACD_Signal, macdScore(close)],
    [LEGACY_SIGNALS.Bollinger_Bands, bollingerScore(close)],
    [LEGACY_SIGNALS.Stochastic_Oscillator, stochasticScore(close, high, low)],
    [LEGACY_SIGNALS.ADX_Trend, adxScore(close, high, low)],
    [LEGACY_SIGNALS.Combined_Momentum, combinedMomentumScore(close, high, low)],
    [LEGACY_SIGNALS.Pattern_Recognition, patternScore(close)],
    [LEGACY_SIGNALS.Mean_Reversion, meanReversionScore(close)],
    [LEGACY_SIGNALS.Liquidity_Based, liquidityScore(close)],
  ];
  const n = close.length;
  const out: ConfluenceScore = {
    ...emptyScore(n),
    confidence: nanArray(n),
    aligned: new Array<boolean>(n).fill(false),
  };
  let first = 0;
  while (first < n && Number.isNaN(close[first]!)) first++;
  const c = close.slice(first);

  for (let t = first; t < n; t++) {
    if (Number.isNaN(close[t]!)) continue;
    const market = marketCondition(c, t - first);
    const volPenalty = market.volatility * VOLATILITY_PENALTY;
    const liqBonus = (DEFAULT_LIQUIDITY * LIQUIDITY_BONUS) / 100;
    const rows = parts.map(([spec, s]) => {
      const score = orZero(s.score[t]!);
      const strength = orZero(s.strength[t]!);
      // The fallback liquidity signal never set timeframeAlignment.
      const aligned = spec.name !== 'Liquidity_Based' && Math.abs(score) > 0.1;
      const weight = Math.max(
        0,
        spec.weight * regimeWeight(market.type, spec.name) +
          (aligned ? ALIGNMENT_BONUS : 0) +
          clamp(strength, 0, 1) * 0.1,
      );
      const riskAdjusted = clamp(score * weight - volPenalty + liqBonus, -1, 1);
      return { score, met: strength >= spec.threshold, weight, riskAdjusted, aligned };
    });

    const total = rows.length;
    const met = rows.filter((r) => r.met).length;
    const pos = rows.filter((r) => r.riskAdjusted > 0).length;
    const neg = rows.filter((r) => r.riskAdjusted < 0).length;
    const disagreement = Math.min(1, Math.abs(pos - neg) / total);
    const disagreementPenalty = pos > 0 && neg > 0 ? 0.15 * (1 - disagreement) : 0;

    const agg = rows
      .map((r) => ({ value: r.score, weight: Math.max(0.0001, r.weight) }))
      .sort((a, b) => a.value - b.value);
    const med = weightedMedian(agg);
    const trimN = Math.floor(agg.length * 0.1);
    const trimmed = agg.slice(trimN, agg.length - trimN);
    const mean =
      trimmed.reduce((s, v) => s + v.value * v.weight, 0) /
      trimmed.reduce((s, v) => s + v.weight, 0);
    let score = clamp(0.6 * med + 0.4 * mean, -1, 1);
    const confidence = met / total;
    let strength = clamp(Math.abs(score) * (0.5 + 0.5 * confidence), 0, 1);
    if (met < MIN_CONFLUENCE) {
      score *= 0.4;
      strength *= 0.6;
    }
    out.score[t] = clamp(score - disagreementPenalty, -1, 1);
    out.strength[t] = strength;
    out.confidence[t] = confidence;
    out.aligned[t] = rows.some((r) => r.aligned);
  }
  return out;
}

/** NaN (no data / warm-up) is flat. */
export function longFlat(s: LegacyScore, threshold: number): number[] {
  let holding = false;
  return s.score.map((score, t) => {
    const strength = s.strength[t]!;
    if (Number.isNaN(score) || Number.isNaN(strength)) holding = false;
    else if (!holding && score > 0 && strength >= threshold) holding = true;
    else if (holding && score < 0 && strength >= threshold) holding = false;
    return holding ? 1 : 0;
  });
}
