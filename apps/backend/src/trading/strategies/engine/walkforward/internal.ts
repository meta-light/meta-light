// Shared helpers for the port of backtester/walkforward (QuantJourney Backtester, Apache 2.0).
// No single Python counterpart: replaces dateutil.relativedelta month math,
// pandas DatetimeIndex slicing, Python/numpy seeded RNGs and warnings.warn.

// --- ISO dates (YYYY-MM-DD, compared lexically) ---------------------------

function parseIso(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m)
    throw new Error(
      `Expected an ISO date (YYYY-MM-DD), got ${JSON.stringify(date)}`,
    );
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function formatIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Calendar month shift with end-of-month clamping, like `relativedelta(months=n)`. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parseIso(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return formatIso(ny, nm, Math.min(d, lastDay));
}

/** Calendar day shift, like `+ pd.Timedelta(days=n)`. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parseIso(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return formatIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** First index in sorted `dates` with `dates[i] >= value` (or `> value` when `strict`). */
function lowerBound(
  dates: readonly string[],
  value: string,
  strict = false,
): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const below = strict ? dates[mid]! <= value : dates[mid]! < value;
    if (below) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Sorted trading dates inside the inclusive range `[from, to]`. */
export function datesBetween(
  dates: readonly string[],
  from: string,
  to: string,
): string[] {
  return dates.slice(lowerBound(dates, from), lowerBound(dates, to, true));
}

/** Last trading date strictly before `date`, or undefined. */
export function lastDateBefore(
  dates: readonly string[],
  date: string,
): string | undefined {
  const i = lowerBound(dates, date);
  return i > 0 ? dates[i - 1] : undefined;
}

// --- Seeded RNG -------------------------------------------------------------

/**
 * Mulberry32 uniform generator on [0, 1). Deterministic per seed, but NOT the
 * same stream as Python's `random.Random` or numpy's `default_rng`, so sampled
 * outputs differ from the Python originals for the same seed.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `k` distinct items drawn without replacement (partial Fisher-Yates). */
export function sampleWithoutReplacement<T>(
  items: readonly T[],
  k: number,
  rand: () => number,
): T[] {
  const pool = items.slice();
  const n = pool.length;
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(rand() * (n - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k);
}

// --- Warnings ---------------------------------------------------------------

const warned = new Set<string>();

/** Print a deprecation-style warning once per message, like Python's default filter. */
export function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}
