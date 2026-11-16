import { cached, getJsonText, rateLimiter } from './cache';
import type { Station } from './cities';
import { isoDate, monthEnd, monthsBetween } from './time';

const URL = 'https://previous-runs-api.open-meteo.com/v1/forecast';
export const MODELS = ['gfs_seamless', 'ecmwf_ifs025', 'icon_seamless', 'gem_seamless'] as const;
export const LEADS = [1, 2, 3] as const;
export type LeadDays = (typeof LEADS)[number];

const limit = rateLimiter(400);

export interface ForecastSeries {
  times: number[];
  byLead: Record<LeadDays, (number | null)[]>;
}

type Hourly = Record<string, (number | null)[] | string[]>;

async function month(station: Station, start: string): Promise<{ times: number[]; byLead: Record<number, (number | null)[]> }> {
  const end = monthEnd(start);
  const today = isoDate(Date.now());
  return cached(
    `openmeteo/${station.icao}-${start.slice(0, 7)}`,
    async () => {
      await limit();
      const vars = LEADS.map((n) => `temperature_2m_previous_day${n}`).join(',');
      const last = end < today ? end : today;
      const res = await getJsonText<{ hourly: Hourly }>(
        `${URL}?latitude=${station.lat}&longitude=${station.lon}&hourly=${vars}` +
          `&start_date=${start}&end_date=${last}&temperature_unit=fahrenheit&timezone=GMT&models=${MODELS.join(',')}`,
      );
      const times = (res.hourly.time as string[]).map((t) => Date.parse(`${t}:00Z`));
      const byLead: Record<number, (number | null)[]> = {};
      for (const n of LEADS) {
        const cols = MODELS.map((m) => res.hourly[`temperature_2m_previous_day${n}_${m}`] as (number | null)[] | undefined)
          .filter((c): c is (number | null)[] => Array.isArray(c));
        byLead[n] = times.map((_, i) => {
          let s = 0;
          let k = 0;
          for (const c of cols) {
            const v = c[i];
            if (v != null) {
              s += v;
              k++;
            }
          }
          return k ? s / k : null;
        });
      }
      return { times, byLead };
    },
    () => end < today,
  );
}

export async function forecastSeries(station: Station, from: string, to: string): Promise<ForecastSeries> {
  const times: number[] = [];
  const byLead = { 1: [], 2: [], 3: [] } as Record<LeadDays, (number | null)[]>;
  for (const m of monthsBetween(from, to)) {
    const part = await month(station, m);
    times.push(...part.times);
    for (const n of LEADS) byLead[n].push(...part.byLead[n]!);
  }
  return { times, byLead };
}

const HOUR = 3_600_000;
export function issuedBy(h: number, lead: number): number {
  const hourOfDay = (h % 86_400_000) / HOUR;
  return h - lead * 86_400_000 + Math.max(0, 6 - hourOfDay) * HOUR;
}

export function forecastMax(f: ForecastSeries, from: number, to: number, asOf: number): number | null {
  let lo = 0;
  let hi = f.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (f.times[mid]! < from) lo = mid + 1;
    else hi = mid;
  }
  let max: number | null = null;
  let n = 0;
  for (let i = lo; i < f.times.length && f.times[i]! < to; i++) {
    const h = f.times[i]!;
    let v: number | null = null;
    for (const lead of LEADS) {
      if (issuedBy(h, lead) <= asOf) {
        v = f.byLead[lead][i] ?? null;
        if (v != null) break;
      }
    }
    if (v == null) return null;
    max = max == null ? v : Math.max(max, v);
    n++;
  }
  return n ? max : null;
}
