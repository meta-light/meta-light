import { datesBetween, lastDateBefore, warnOnce } from '../internal';

export type PurgeResult = [
  effectiveIsEnd: string,
  purgeStart: string | null,
  purgeEnd: string | null,
];

export interface PreOosPurgeArgs {
  isStart: string;
  isEnd: string;
  oosStart: string;
  purgeDays: number;
  extraPreOosPurgePct: number;
  tradingDates: readonly string[];
  maxHoldingPeriodDays?: number | null;
}

export function computePreOosPurge(args: PreOosPurgeArgs): PurgeResult {
  const {
    isStart,
    isEnd,
    oosStart,
    purgeDays,
    extraPreOosPurgePct,
    tradingDates,
    maxHoldingPeriodDays,
  } = args;
  const isDates = datesBetween(tradingDates, isStart, isEnd);
  const isLength = isDates.length;
  if (isLength === 0) return [isEnd, isEnd, isEnd];

  const effectivePurge =
    maxHoldingPeriodDays != null
      ? Math.max(purgeDays, maxHoldingPeriodDays)
      : purgeDays;
  const percentageExtensionDays = Math.max(
    0,
    Math.trunc(extraPreOosPurgePct * isLength),
  );
  const totalRemove = effectivePurge + percentageExtensionDays;

  if (totalRemove === 0) return [isDates[isLength - 1]!, null, null];

  let effectiveIsEnd: string;
  let purgeStart: string;
  if (totalRemove >= isLength) {
    effectiveIsEnd = isDates[0]!;
    purgeStart = isDates[0]!;
  } else {
    effectiveIsEnd = isDates[isLength - totalRemove - 1]!;
    purgeStart = isDates[isLength - totalRemove]!;
  }
  const purgeEnd = lastDateBefore(tradingDates, oosStart) ?? oosStart;
  return [effectiveIsEnd, purgeStart, purgeEnd];
}

export function computePurgeEmbargo(
  args: Omit<PreOosPurgeArgs, 'extraPreOosPurgePct'> & { embargoPct: number },
): PurgeResult {
  warnOnce(
    'computePurgeEmbargo/embargoPct is deprecated; use computePreOosPurge({ extraPreOosPurgePct }). ' +
      'The behavior is a pre-OOS purge extension, not a post-test embargo.',
  );
  const { embargoPct, ...rest } = args;
  return computePreOosPurge({ ...rest, extraPreOosPurgePct: embargoPct });
}
