// Ported from backtester/portfolio/rebalance.py (QuantJourney Backtester, Apache 2.0)
//
// Calendar rebalance flags (RebalanceEngine._calendar_flags). Scheduled dates
// are generated the way pandas.date_range does for the supported offsets, then
// snapped onto the series' own trading dates: end-of-period schedules snap
// back to the last trading date on or before the scheduled date, start-of-
// period schedules snap forward within the same period, and weekly schedules
// snap inside the scheduled calendar week.

import { bisectLeft, bisectRight, dateMs } from './frame-utils';

const DAY_MS = 86_400_000;

const LEGACY_FREQ: Record<string, string> = {
  BM: 'BME',
  BQ: 'BQE',
  BA: 'BYE',
  BAS: 'BYS',
};

export function normalizeFreq(freq: string): string {
  return LEGACY_FREQ[freq] ?? freq;
}

/** pandas weekday: Monday = 0 ... Sunday = 6. */
const weekdayOf = (ms: number): number => (new Date(ms).getUTCDay() + 6) % 7;

interface PeriodRule {
  /** Months (1-12) on which the period ends or starts. */
  months: readonly number[];
  start: boolean;
  business: boolean;
  /** Period used to validate forward snaps of start schedules. */
  period: 'M' | 'Q' | 'Y';
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTER_END = [3, 6, 9, 12];
const QUARTER_START = [1, 4, 7, 10];

const PERIOD_RULES: Record<string, PeriodRule> = {
  ME: { months: ALL_MONTHS, start: false, business: false, period: 'M' },
  BME: { months: ALL_MONTHS, start: false, business: true, period: 'M' },
  QE: { months: QUARTER_END, start: false, business: false, period: 'Q' },
  BQE: { months: QUARTER_END, start: false, business: true, period: 'Q' },
  YE: { months: [12], start: false, business: false, period: 'Y' },
  BYE: { months: [12], start: false, business: true, period: 'Y' },
  MS: { months: ALL_MONTHS, start: true, business: false, period: 'M' },
  BMS: { months: ALL_MONTHS, start: true, business: true, period: 'M' },
  QS: { months: QUARTER_START, start: true, business: false, period: 'Q' },
  BQS: { months: QUARTER_START, start: true, business: true, period: 'Q' },
  YS: { months: [1], start: true, business: false, period: 'Y' },
  BYS: { months: [1], start: true, business: true, period: 'Y' },
};

/** Anchor day (UTC midnight ms) of `rule` in the given year/month (month 1-12). */
function anchorDay(rule: PeriodRule, year: number, month: number): number {
  if (rule.start) {
    let ms = Date.UTC(year, month - 1, 1);
    if (rule.business) while (weekdayOf(ms) >= 5) ms += DAY_MS;
    return ms;
  }
  let ms = Date.UTC(year, month, 0);
  if (rule.business) while (weekdayOf(ms) >= 5) ms -= DAY_MS;
  return ms;
}

/** pandas.date_range(start, end, freq) for the month/quarter/year offsets. */
function periodSchedule(
  rule: PeriodRule,
  startMs: number,
  endMs: number,
): number[] {
  const timeOfDay = ((startMs % DAY_MS) + DAY_MS) % DAY_MS;
  const s = new Date(startMs);
  const out: number[] = [];
  let year = s.getUTCFullYear();
  let month = s.getUTCMonth() + 1;
  for (;;) {
    if (rule.months.includes(month)) {
      const c = anchorDay(rule, year, month) + timeOfDay;
      if (c > endMs) break;
      if (c >= startMs) out.push(c);
    } else if (Date.UTC(year, month - 1, 1) > endMs) {
      break;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function periodKey(ms: number, period: 'M' | 'Q' | 'Y'): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (period === 'M') return y * 12 + m;
  if (period === 'Q') return y * 4 + Math.floor(m / 3);
  return y;
}

export interface CalendarSpec {
  frequency: string | null;
  weekday: number;
  calendarDates?: readonly string[];
}

/** Boolean rebalance flags aligned with `dates` (sorted ascending). */
export function calendarFlags(
  dates: readonly string[],
  spec: CalendarSpec,
): boolean[] {
  const n = dates.length;
  const flags = new Array<boolean>(n).fill(false);
  if (n === 0) return flags;
  const ms = dates.map(dateMs);

  if (spec.calendarDates !== undefined) {
    const scheduled = new Set(spec.calendarDates.map(dateMs));
    return ms.map((t) => scheduled.has(t));
  }

  const freq = spec.frequency;
  if (freq === null) return flags;
  if (freq === 'D') return flags.fill(true);

  if (freq === 'W') {
    const anchor = ((spec.weekday % 7) + 7) % 7;
    const first = ms[0]!;
    let sched = first + ((anchor - weekdayOf(first) + 7) % 7) * DAY_MS;
    for (; sched <= ms[n - 1]!; sched += 7 * DAY_MS) {
      const weekStart = sched - weekdayOf(sched) * DAY_MS;
      const weekEnd = weekStart + 6 * DAY_MS;
      const left = bisectRight(ms, sched) - 1;
      if (left >= 0 && ms[left]! >= weekStart) {
        flags[left] = true;
        continue;
      }
      const right = bisectLeft(ms, sched);
      if (right < n && ms[right]! <= weekEnd) flags[right] = true;
    }
    return flags;
  }

  const everyN = /^(\d+)D$/.exec(freq);
  if (everyN) {
    const step = Number(everyN[1]);
    if (step <= 0) throw new Error(`Unsupported rebalance frequency: ${freq}`);
    for (let i = 0; i < n; i += step) flags[i] = true;
    return flags;
  }

  const rule = PERIOD_RULES[normalizeFreq(freq)];
  if (rule === undefined)
    throw new Error(`Unsupported rebalance frequency: ${freq}`);
  for (const sched of periodSchedule(rule, ms[0]!, ms[n - 1]!)) {
    if (rule.start) {
      const pos = bisectLeft(ms, sched);
      if (
        pos < n &&
        periodKey(ms[pos]!, rule.period) === periodKey(sched, rule.period)
      )
        flags[pos] = true;
    } else {
      const pos = bisectRight(ms, sched) - 1;
      if (pos >= 0) flags[pos] = true;
    }
  }
  return flags;
}
