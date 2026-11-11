// Ported from backtester/walkforward/folds/purge.py (QuantJourney Backtester, Apache 2.0)
//
// Pre-OOS purge shared across all fold schemes. Removes the last N trading
// days from IS to prevent label leakage; an optional percentage extends that
// same exclusion window. This is not a classical post-test embargo. When
// `maxHoldingPeriodDays` is set, purge = max(purgeDays, holding).

import { datesBetween, lastDateBefore, warnOnce } from "../internal";

/** [effectiveIsEnd, purgeStart, purgeEnd]; purge bounds are null when nothing is excluded. */
export type PurgeResult = [effectiveIsEnd: string, purgeStart: string | null, purgeEnd: string | null];

export interface PreOosPurgeArgs {
  isStart: string;
  isEnd: string;
  oosStart: string;
  purgeDays: number;
  extraPreOosPurgePct: number;
  /** Sorted ISO trading dates. */
  tradingDates: readonly string[];
  maxHoldingPeriodDays?: number | null;
}

export function computePreOosPurge(args: PreOosPurgeArgs): PurgeResult {
  const { isStart, isEnd, oosStart, purgeDays, extraPreOosPurgePct, tradingDates, maxHoldingPeriodDays } = args;
  const isDates = datesBetween(tradingDates, isStart, isEnd);
  const isLength = isDates.length;
  if (isLength === 0) return [isEnd, isEnd, isEnd];

  const effectivePurge = maxHoldingPeriodDays != null ? Math.max(purgeDays, maxHoldingPeriodDays) : purgeDays;
  const percentageExtensionDays = Math.max(0, Math.trunc(extraPreOosPurgePct * isLength));
  const totalRemove = effectivePurge + percentageExtensionDays;

  // No purge: report an empty exclusion window as null, never as the whole IS window.
  if (totalRemove === 0) return [isDates[isLength - 1]!, null, null];

  let effectiveIsEnd: string;
  let purgeStart: string;
  if (totalRemove >= isLength) {
    // Combined pre-OOS purge exceeds the IS window.
    effectiveIsEnd = isDates[0]!;
    purgeStart = isDates[0]!;
  } else {
    effectiveIsEnd = isDates[isLength - totalRemove - 1]!;
    purgeStart = isDates[isLength - totalRemove]!;
  }
  const purgeEnd = lastDateBefore(tradingDates, oosStart) ?? oosStart;
  return [effectiveIsEnd, purgeStart, purgeEnd];
}

/**
 * @deprecated Use `computePreOosPurge`. Historical `embargoPct` extends the
 * purge before the current OOS window; it never was a post-test embargo.
 */
export function computePurgeEmbargo(
  args: Omit<PreOosPurgeArgs, "extraPreOosPurgePct"> & { embargoPct: number },
): PurgeResult {
  warnOnce(
    "computePurgeEmbargo/embargoPct is deprecated; use computePreOosPurge({ extraPreOosPurgePct }). " +
      "The behavior is a pre-OOS purge extension, not a post-test embargo.",
  );
  const { embargoPct, ...rest } = args;
  return computePreOosPurge({ ...rest, extraPreOosPurgePct: embargoPct });
}
