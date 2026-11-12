// Ported from backtester/walkforward/statistics/deflated_sharpe.py (QuantJourney Backtester, Apache 2.0)
//
// Deflated Sharpe Ratio (Bailey and Lopez de Prado, 2014): the probability
// that the observed Sharpe beats the expected maximum Sharpe of N trials
// under the null. Probabilistic Sharpe Ratio (Bailey and Lopez de Prado, 2012).
// Sharpe inputs must be on the same (per-observation) scale as `nObs`.

import { normCdf, normPpf } from './normal';

const EULER_GAMMA = 0.5772156649015329;

/** Expected maximum Sharpe of `nTrials` independent trials with cross-trial std `srStd`. */
export function expectedMaxSharpe(srStd: number, nTrials: number): number {
  if (!Number.isFinite(nTrials) || nTrials <= 1) return 0;
  const z1 = normPpf(1 - 1 / nTrials);
  const z2 = normPpf(1 - 1 / (nTrials * Math.E));
  return srStd * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2);
}

export interface ProbabilisticSharpeOptions {
  benchmarkSr?: number;
  nObs: number;
  skewness?: number;
  /** Non-excess kurtosis (normal = 3). */
  kurtosis?: number;
}

/** PSR: probability that the true Sharpe exceeds `benchmarkSr`. 0 when nObs < 2. */
export function probabilisticSharpe(
  observedSr: number,
  options: ProbabilisticSharpeOptions,
): number {
  const { benchmarkSr = 0, nObs, skewness = 0, kurtosis = 3 } = options;
  if (nObs == null || nObs < 2) return 0;
  let denomSq =
    1 - skewness * observedSr + ((kurtosis - 1) / 4) * observedSr ** 2;
  if (denomSq <= 0) denomSq = 1 + 0.5 * observedSr ** 2;
  const z =
    ((observedSr - benchmarkSr) * Math.sqrt(nObs - 1)) / Math.sqrt(denomSq);
  return normCdf(z);
}

export interface DeflatedSharpeOptions {
  /** Effective independent trials (finite, >= 1, <= nTrials when nTrials >= 1). */
  effectiveNTrials?: number;
  /** Defaults to the best finite trial Sharpe. */
  observedSr?: number;
  nObs: number;
  skewness?: number;
  kurtosis?: number;
  benchmarkSr?: number;
}

/**
 * DSR in [0, 1]. Non-finite trial Sharpes are dropped. `nTrials` defaults to
 * the number of finite trials. Returns 0 when there is nothing to evaluate.
 */
export function deflatedSharpe(
  trialSharpes: readonly number[],
  nTrials: number | null | undefined,
  options: DeflatedSharpeOptions,
): number {
  const {
    effectiveNTrials,
    nObs,
    skewness = 0,
    kurtosis = 3,
    benchmarkSr = 0,
  } = options;
  const arr = trialSharpes.filter((v) => Number.isFinite(v));
  let observedSr = options.observedSr;
  if (observedSr === undefined) {
    if (arr.length === 0) return 0;
    observedSr = Math.max(...arr);
  }
  const rawN = nTrials != null ? Math.trunc(nTrials) : arr.length;
  if (rawN < 0) throw new Error('nTrials must be >= 0');

  let effectiveN = rawN;
  if (effectiveNTrials !== undefined) {
    effectiveN = effectiveNTrials;
    if (!Number.isFinite(effectiveN) || effectiveN < 1)
      throw new Error('effectiveNTrials must be finite and >= 1');
    if (rawN >= 1 && effectiveN > rawN)
      throw new Error('effectiveNTrials must be <= nTrials');
  }

  let srStd = 0;
  if (arr.length > 1) {
    const m = arr.reduce((s, v) => s + v, 0) / arr.length;
    srStd = Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); // ddof = 0
  }
  const sr0 =
    effectiveN <= 1 || srStd === 0
      ? benchmarkSr
      : benchmarkSr + expectedMaxSharpe(srStd, effectiveN);
  return probabilisticSharpe(observedSr, {
    benchmarkSr: sr0,
    nObs,
    skewness,
    kurtosis,
  });
}
