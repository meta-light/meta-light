import type { FoldWindow } from '../../../core/index';
import type { ResolvedWalkForwardConfig } from '../config';
import { addDays, addMonths, datesBetween } from '../internal';
import { computePreOosPurge } from './purge';

export interface Fold extends FoldWindow {
  scheme: string;
  effectiveIsEnd: string;
  purgeStart: string | null;
  purgeEnd: string | null;
}

export interface FoldScheme {
  generateFolds(
    start: string,
    end: string,
    tradingDates: readonly string[],
  ): Fold[];
}

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
