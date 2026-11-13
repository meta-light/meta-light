// Ported from backtester/walkforward/folds/base.py (QuantJourney Backtester, Apache 2.0)
//
// Also holds the fold loop shared by rolling.py, expanding.py and anchored.py,
// which in Python are three near-identical copies differing only in where the
// IS window starts and how the minimum-IS check treats an empty window.

import type { FoldWindow } from '../../../core/index';
import type { ResolvedWalkForwardConfig } from '../config';
import { addDays, addMonths, datesBetween } from '../internal';
import { computePreOosPurge } from './purge';

/**
 * One walk-forward fold. Dates are inclusive ISO trading dates. The effective
 * IS window is `[trainStart, effectiveIsEnd]` after the pre-OOS purge.
 */
export interface Fold extends FoldWindow {
  scheme: string;
  effectiveIsEnd: string;
  /** First excluded date, null when no dates are purged. */
  purgeStart: string | null;
  /** Last excluded date (oosStart minus one trading day), null when no dates are purged. */
  purgeEnd: string | null;
}

export interface FoldScheme {
  generateFolds(
    start: string,
    end: string,
    tradingDates: readonly string[],
  ): Fold[];
}

/** @internal Fold loop for the rolling, expanding and anchored schemes. */
export function generateWindowFolds(
  cfg: ResolvedWalkForwardConfig,
  scheme: 'rolling' | 'expanding' | 'anchored',
  start: string,
  end: string,
  tradingDates: readonly string[],
): Fold[] {
  const folds: Fold[] = [];
  const rolling = scheme === 'rolling';
  let foldId = 0;
  // Advance the cursor cumulatively (clamping each step), as relativedelta does.
  for (
    let oosCursor = addMonths(start, cfg.trainMonths);
    oosCursor <= end;
    oosCursor = addMonths(oosCursor, cfg.stepMonths)
  ) {
    const trainStartDt = rolling
      ? addMonths(oosCursor, -cfg.trainMonths)
      : start;
    const trainEndDt = addDays(oosCursor, -1);
    const oosEndCandidate = addDays(addMonths(oosCursor, cfg.testMonths), -1);
    const oosEndDt = oosEndCandidate < end ? oosEndCandidate : end;

    const trainDates = datesBetween(tradingDates, trainStartDt, trainEndDt);
    const oosDates = datesBetween(tradingDates, oosCursor, oosEndDt);
    const minTrain = datesBetween(
      tradingDates,
      trainStartDt,
      addMonths(trainStartDt, cfg.minTrainMonths),
    ).length;
    const tooShort = rolling
      ? trainDates.length < minTrain || trainDates.length === 0
      : trainDates.length < Math.max(1, minTrain);
    if (tooShort || oosDates.length === 0) continue;

    const trainStart = trainDates[0]!;
    const trainEnd = trainDates[trainDates.length - 1]!;
    const oosStart = oosDates[0]!;
    const [effectiveIsEnd, purgeStart, purgeEnd] = computePreOosPurge({
      isStart: trainStart,
      isEnd: trainEnd,
      oosStart,
      purgeDays: cfg.purgeDays,
      extraPreOosPurgePct: cfg.resolvedExtraPreOosPurgePct,
      tradingDates,
      maxHoldingPeriodDays: cfg.maxHoldingPeriodDays,
    });
    folds.push({
      foldId,
      scheme,
      trainStart,
      trainEnd,
      oosStart,
      oosEnd: oosDates[oosDates.length - 1]!,
      effectiveIsEnd,
      purgeStart,
      purgeEnd,
    });
    foldId += 1;
  }
  return folds;
}
