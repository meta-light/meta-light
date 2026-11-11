// Ported from backtester/walkforward/statistics/pbo.py (QuantJourney Backtester, Apache 2.0)
//
// Walk-forward rank-stability diagnostics and legacy PBO helpers
// (Bailey, Borwein, Lopez de Prado and Zhu, 2017).
//
// Canonical CSCV PBO needs trial-level OOS data on symmetric combinatorial
// splits. The rolling walk-forward top-K pipeline does not do CSCV, so its
// output must not be reported as canonical PBO. This module provides:
// - selectedTrialRankLogit / walkForwardTopKRankFailureRate: per fold, the
//   IS-selected trial's relative OOS rank among the top-K re-tested trials,
//   and the fraction of folds where it landed in the bottom half.
// - probabilityOfBacktestOverfitting: deprecated, always NaN (the old
//   fold-level version had no trials, selection or rank).
// - isOosTransferDistribution: IS to OOS transfer ratios across fold splits,
//   for plotting only.

import { sampleWithoutReplacement, seededRandom, warnOnce } from "../internal";

// --- Rolling top-K OOS rank-stability diagnostic ---------------------------

/**
 * Logit of the IS-selected trial's relative OOS rank among all K candidates
 * (higher value = better). lambda = ln(w / (1 - w)), w = rank / (K + 1), with
 * average-tie ranking (1 = worst, K = best). lambda <= 0 means the selection
 * landed in the bottom half OOS. null when K < 2 or the selection is not finite.
 */
export function selectedTrialRankLogit(selectedValue: number, candidateValues: readonly number[]): number | null {
  const vals = candidateValues.filter((v) => Number.isFinite(v));
  if (vals.length < 2 || !Number.isFinite(selectedValue)) return null;
  const below = vals.filter((v) => v < selectedValue).length;
  const ties = vals.filter((v) => v === selectedValue).length;
  const rank = below + (ties + 1) / 2;
  const omega = rank / (vals.length + 1);
  if (!(omega > 0 && omega < 1)) return null;
  return Math.log(omega / (1 - omega));
}

/** Fraction of folds with logit <= 0, NaN when no finite logits. Not CSCV PBO. */
export function walkForwardTopKRankFailureRate(logits: ReadonlyArray<number | null | undefined>): number {
  const finite = logits.filter((l): l is number => l != null && Number.isFinite(l));
  if (finite.length === 0) return NaN;
  return finite.filter((l) => l <= 0).length / finite.length;
}

/** @deprecated Use `selectedTrialRankLogit`. */
export function selectedTrialLogit(selectedValue: number, candidateValues: readonly number[]): number | null {
  warnOnce("selectedTrialLogit is deprecated; use selectedTrialRankLogit. The rolling top-K diagnostic is not canonical CSCV PBO.");
  return selectedTrialRankLogit(selectedValue, candidateValues);
}

/** @deprecated Use `walkForwardTopKRankFailureRate`. */
export function pboFromSelectedRanks(logits: ReadonlyArray<number | null | undefined>): number {
  warnOnce("pboFromSelectedRanks is deprecated; use walkForwardTopKRankFailureRate. The result is not canonical CSCV PBO.");
  return walkForwardTopKRankFailureRate(logits);
}

// --- Deprecated fold-level pseudo-PBO --------------------------------------

/**
 * @deprecated Not the CSCV PBO; always returns NaN. Fold-level Sharpes
 * contain no trials, selection or rank. Set `rankStabilityTrials` >= 2 with
 * an optimizer to get the rolling top-K rank-failure diagnostic instead.
 */
export function probabilityOfBacktestOverfitting(
  isSharpes: readonly number[],
  oosSharpes: readonly number[],
  _options: { nPartitions?: number; maxCombinations?: number; seed?: number } = {},
): number {
  if (isSharpes.length !== oosSharpes.length) throw new Error("isSharpes and oosSharpes must have equal length");
  warnOnce(
    "probabilityOfBacktestOverfitting(isSharpes, oosSharpes) is deprecated: fold-level Sharpes cannot yield the " +
      "CSCV PBO. It now returns NaN. Enable rankStabilityTrials for the rolling top-K rank-failure diagnostic.",
  );
  return NaN;
}

// --- Diagnostic transfer-ratio distribution (plotting only) -----------------

function nChooseK(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** All k-subsets of 0..n-1 in lexicographic order (Python itertools.combinations). */
function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    out.push(idx.slice());
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) return out;
    idx[i]! += 1;
    for (let j = i + 1; j < k; j += 1) idx[j] = idx[j - 1]! + 1;
  }
}

/**
 * For each split of the folds into halves J / J-bar: mean(OOS in J-bar) /
 * mean(IS in J), with sign-based fallbacks when mean IS <= 0. Values <= 0 mark
 * splits where OOS collapsed. Empty with fewer than 4 folds. When there are
 * more than `maxCombinations` splits, a seeded random subset is used; that RNG
 * differs from numpy's, so sampled outputs differ from Python's.
 */
export function isOosTransferDistribution(
  isSharpes: readonly number[],
  oosSharpes: readonly number[],
  options: { maxCombinations?: number; seed?: number } = {},
): number[] {
  const { maxCombinations = 10_000, seed = 42 } = options;
  const n = isSharpes.length;
  if (n < 4) return [];
  const half = Math.floor(n / 2);

  let splits: number[][];
  if (nChooseK(n, half) <= maxCombinations) {
    splits = combinations(n, half);
  } else {
    const rand = seededRandom(seed);
    const all = indices(n);
    const seen = new Map<string, number[]>();
    while (seen.size < maxCombinations) {
      const pick = sampleWithoutReplacement(all, half, rand).sort((a, b) => a - b);
      seen.set(pick.join(","), pick);
    }
    splits = [...seen.values()];
  }

  return splits.map((j) => {
    const inJ = new Set(j);
    const isMean = j.reduce((s, i) => s + isSharpes[i]!, 0) / j.length;
    const jBar = indices(n).filter((i) => !inJ.has(i));
    const oosMean = jBar.reduce((s, i) => s + oosSharpes[i]!, 0) / jBar.length;
    if (isMean > 0) return oosMean / isMean;
    if (isMean === 0) return oosMean <= 0 ? 0 : 1;
    return oosMean >= 0 ? 1 : 0;
  });
}

function indices(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** @deprecated Use `isOosTransferDistribution`. Not a CSCV PBO logit distribution. */
export function pboLogitDistribution(
  isSharpes: readonly number[],
  oosSharpes: readonly number[],
  options: { maxCombinations?: number; seed?: number } = {},
): number[] {
  warnOnce("pboLogitDistribution is deprecated; use isOosTransferDistribution. It is not a CSCV PBO logit distribution.");
  return isOosTransferDistribution(isSharpes, oosSharpes, options);
}
