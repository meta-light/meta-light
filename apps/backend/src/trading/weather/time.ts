const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const dayMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date: string, n: number): string => isoDate(dayMs(date) + n * DAY);

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function wallAsUtc(ms: number, tz: string): number {
  const p = Object.fromEntries(fmt(tz).formatToParts(ms).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
}

export const localDate = (ms: number, tz: string): string => isoDate(wallAsUtc(ms, tz));

export function zonedMs(date: string, hour: number, tz: string): number {
  const guess = dayMs(date) + hour * HOUR;
  let t = guess - (wallAsUtc(guess, tz) - guess);
  t = guess - (wallAsUtc(t, tz) - t);
  return t;
}

export function stdDayWindow(date: string, stdOffset: number): [number, number] {
  const start = dayMs(date) - stdOffset * HOUR;
  return [start, start + DAY];
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > end) break;
    out.push(`${key}-01`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export const monthEnd = (monthStart: string): string => {
  const [y, m] = monthStart.split('-').map(Number) as [number, number];
  return isoDate(Date.UTC(y, m, 0));
};
