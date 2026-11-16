import { maxBetween, type Obs } from './actuals';
import type { City, Venue } from './cities';
import { forecastMax, type ForecastSeries } from './forecasts';
import { addDays, stdDayWindow, zonedMs } from './time';

const PUBLISH_LAG = 6 * 3_600_000;

export type Lead = 'd-2' | 'd-1' | 'd0-am' | 'd0-pm';
export const LEAD_NAMES: readonly Lead[] = ['d-2', 'd-1', 'd0-am', 'd0-pm'];

const DECISION: Record<Lead, { day: number; hour: number }> = {
  'd-2': { day: -2, hour: 12 },
  'd-1': { day: -1, hour: 12 },
  'd0-am': { day: 0, hour: 10 },
  'd0-pm': { day: 0, hour: 15 },
};

export interface ModelParams {
  window: number;
  minResiduals: number;
  bandwidth: number;
}

export const DEFAULT_MODEL: ModelParams = { window: 60, minResiduals: 30, bandwidth: 1 };

export interface CityData {
  city: City;
  venue: Venue;
  forecast: ForecastSeries;
  obs: Obs[];
  actuals: Map<string, number>;
}

export const decisionMs = (city: City, date: string, lead: Lead): number =>
  zonedMs(addDays(date, DECISION[lead].day), DECISION[lead].hour, city.tz);

export function dayWindow(d: CityData, date: string): [number, number] {
  if (d.venue === 'kalshi') return stdDayWindow(date, d.city.stdOffset);
  return [zonedMs(date, 0, d.city.tz), zonedMs(addDays(date, 1), 0, d.city.tz)];
}

const FLOOR_SLACK: Record<Venue, number> = { kalshi: 1, polymarket: 0 };

export interface Predictor {
  x: number;
  floor: number | null;
}

export function predictor(d: CityData, date: string, lead: Lead): Predictor | null {
  const [from, to] = dayWindow(d, date);
  const t = decisionMs(d.city, date, lead);
  if (t <= from) {
    const x = forecastMax(d.forecast, from, to, t);
    return x == null ? null : { x, floor: null };
  }
  const seen = maxBetween(d.obs, from, Math.min(t, to));
  const rest = t < to ? forecastMax(d.forecast, t, to, t) : null;
  if (seen == null && rest == null) return null;
  const x = Math.max(seen ?? -Infinity, rest ?? -Infinity);
  return { x, floor: seen == null ? null : Math.round(seen) - FLOOR_SLACK[d.venue] };
}

export function residuals(d: CityData, date: string, lead: Lead, p: ModelParams, memo: Map<string, number | null>): number[] {
  const t = decisionMs(d.city, date, lead);
  const out: number[] = [];
  for (let k = 1; k <= p.window + 3 && out.length < p.window; k++) {
    const past = addDays(date, -k);
    if (dayWindow(d, past)[1] + PUBLISH_LAG > t) continue;
    const key = `${past}|${lead}`;
    let r = memo.get(key);
    if (r === undefined) {
      const actual = d.actuals.get(past);
      const pr = actual == null ? null : predictor(d, past, lead);
      r = actual == null || pr == null ? null : actual - pr.x;
      memo.set(key, r);
    }
    if (r != null) out.push(r);
  }
  return out.reverse();
}

export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function bucketProbs(
  buckets: readonly { lo: number; hi: number }[],
  pred: Predictor,
  res: readonly number[],
  bandwidth: number,
): number[] {
  const probs = buckets.map(() => 0);
  for (const r of res) {
    const v = pred.floor == null ? pred.x + r : Math.max(pred.floor, pred.x + r);
    buckets.forEach((b, i) => {
      const hi = b.hi === Infinity ? 1 : normCdf((b.hi + 0.5 - v) / bandwidth);
      const lo = b.lo === -Infinity ? 0 : normCdf((b.lo - 0.5 - v) / bandwidth);
      probs[i]! += hi - lo;
    });
  }
  if (pred.floor != null) buckets.forEach((b, i) => b.hi < pred.floor! && (probs[i] = 0));
  const sum = probs.reduce((a, b) => a + b, 0);
  return sum > 0 ? probs.map((p) => p / sum) : probs;
}
