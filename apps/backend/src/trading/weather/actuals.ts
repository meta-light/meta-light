import { cached, getJsonText, getText, rateLimiter } from './cache';
import { isoDate, localDate, monthEnd, monthsBetween } from './time';

const IEM = 'https://mesonet.agron.iastate.edu';
const limit = rateLimiter(250);
const today = (): string => isoDate(Date.now());

export async function cliHighs(icao: string, years: number[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const year of years) {
    const rows = await cached(
      `iem/cli/${icao}-${year}`,
      async () => {
        await limit();
        const res = await getJsonText<{ results: { valid: string; high: number | string }[] }>(
          `${IEM}/json/cli.py?station=${icao}&year=${year}`,
        );
        return res.results.filter((r) => typeof r.high === 'number').map((r) => [r.valid, r.high as number] as const);
      },
      () => `${year}-12-31` < prevDay(today()),
    );
    for (const [d, h] of rows) out.set(d, h);
  }
  return out;
}

const prevDay = (d: string): string => isoDate(Date.parse(`${d}T00:00:00Z`) - 86_400_000);

export interface Obs {
  t: number;
  f: number;
}

export async function hourlyObs(icao: string, from: string, to: string): Promise<Obs[]> {
  const asos = icao.replace(/^K/, '');
  const out: Obs[] = [];
  for (const month of monthsBetween(from, to)) {
    const end = monthEnd(month);
    const rows = await cached(
      `iem/asos/${icao}-${month.slice(0, 7)}`,
      async () => {
        await limit();
        const a = new Date(Date.parse(`${month}T00:00:00Z`) - 86_400_000);
        const b = new Date(Date.parse(`${end}T00:00:00Z`) + 2 * 86_400_000);
        const url =
          `${IEM}/cgi-bin/request/asos.py?station=${asos}&data=tmpf` +
          `&year1=${a.getUTCFullYear()}&month1=${a.getUTCMonth() + 1}&day1=${a.getUTCDate()}` +
          `&year2=${b.getUTCFullYear()}&month2=${b.getUTCMonth() + 1}&day2=${b.getUTCDate()}` +
          `&tz=Etc/UTC&format=onlycomma&latlon=no&missing=empty&report_type=3`;
        const csv = await getText(url);
        const obs: [number, number][] = [];
        for (const line of csv.split('\n').slice(1)) {
          const [, valid, tmpf] = line.split(',');
          if (!valid || !tmpf) continue;
          obs.push([Date.parse(`${valid.replace(' ', 'T')}:00Z`), Number(tmpf)]);
        }
        return obs;
      },
      () => end < prevDay(prevDay(today())),
    );
    for (const [t, f] of rows) out.push({ t, f });
  }
  out.sort((a, b) => a.t - b.t);
  return out.filter((o, i) => i === 0 || o.t !== out[i - 1]!.t);
}

export function dailyMetarHighs(obs: Obs[], tz: string): Map<string, number> {
  const max = new Map<string, number>();
  for (const o of obs) {
    const d = localDate(o.t, tz);
    const m = max.get(d);
    if (m == null || o.f > m) max.set(d, o.f);
  }
  for (const [d, f] of max) max.set(d, Math.round(f));
  return max;
}

export function maxBetween(obs: Obs[], from: number, to: number): number | null {
  let lo = 0;
  let hi = obs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (obs[mid]!.t < from) lo = mid + 1;
    else hi = mid;
  }
  let m: number | null = null;
  for (let i = lo; i < obs.length && obs[i]!.t < to; i++) if (m == null || obs[i]!.f > m) m = obs[i]!.f;
  return m;
}
