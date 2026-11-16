import { cliHighs, dailyMetarHighs, hourlyObs } from './actuals';
import type { City, Venue } from './cities';
import { EventView, brier, fill, stats, type BrierRow, type FillParams, type Stats, type Strategy, type Trade } from './engine';
import { forecastSeries } from './forecasts';
import { kalshiEvents } from './kalshi';
import { LEAD_NAMES, type CityData, type ModelParams } from './model';
import { polymarketEvents } from './polymarket';
import { addDays } from './time';
import type { MarketEvent } from './types';

export interface VenueData {
  venue: Venue;
  city: City;
  events: MarketEvent[];
  data: CityData;
}

export interface LoadArgs {
  since: string;
  until: string;
  log?: (msg: string) => void;
}

export async function loadCity(venue: Venue, city: City, args: LoadArgs): Promise<VenueData> {
  const log = args.log ?? (() => {});
  const { series } = city[venue];
  let last = 0;
  const onProgress = (done: number, total: number) => {
    const pct = Math.floor((done / total) * 10);
    if (pct > last || done === total) {
      last = pct;
      log(`  ${venue} ${city.id}: quotes ${done}/${total}`);
    }
  };
  const opts = { since: args.since, until: args.until, onProgress };
  const events = venue === 'kalshi' ? await kalshiEvents(city.id, series, opts) : await polymarketEvents(city.id, series, opts);
  log(`  ${venue} ${city.id}: ${events.length} events; forecasts + observations`);
  return { venue, city, events, data: await cityData(venue, city, args.since, args.until) };
}

export async function cityData(venue: Venue, city: City, since: string, until: string): Promise<CityData> {
  const { station } = city[venue];
  const from = addDays(since, -75);
  const forecast = await forecastSeries(station, from, until);
  const obs = await hourlyObs(station.icao, from, until);
  const years = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(until.slice(0, 4)); y++) years.push(y);
  const actuals = venue === 'kalshi' ? await cliHighs(station.icao, years) : dailyMetarHighs(obs, city.tz);
  return { city, venue, forecast, obs, actuals };
}

export interface ValidationRow {
  venue: Venue;
  cityId: string;
  events: number;
  checked: number;
  agree: number;
  rate: number;
  mismatches: { date: string; actual: number; won: string; settledHigh: number | null }[];
}

export function validate(v: VenueData): ValidationRow {
  let checked = 0;
  let agree = 0;
  const mismatches: ValidationRow['mismatches'] = [];
  for (const ev of v.events) {
    const actual = v.data.actuals.get(ev.date);
    if (actual == null) continue;
    checked++;
    const ours = ev.buckets.find((b) => actual >= b.lo && actual <= b.hi);
    const won = ev.buckets.find((b) => b.result === 1);
    if (ours && ours === won) agree++;
    else mismatches.push({ date: ev.date, actual, won: won?.label ?? '-', settledHigh: ev.settledHigh });
  }
  return {
    venue: v.venue,
    cityId: v.city.id,
    events: v.events.length,
    checked,
    agree,
    rate: checked ? Math.round((agree / checked) * 1000) / 1000 : 0,
    mismatches,
  };
}

export interface BacktestResult {
  trades: Trade[];
  summary: Record<string, { all: Stats; train: Stats; test: Stats }>;
  byCity: Record<string, Record<string, Stats>>;
  brier: BrierRow[];
}

export function eventViews(v: VenueData, model: ModelParams, fills: FillParams): EventView[] {
  const memo = new Map<string, number | null>();
  return v.events.map((ev) => new EventView(ev, v.data, model, fills, memo));
}

export function backtest(
  venues: readonly VenueData[],
  strategies: readonly Strategy[],
  model: ModelParams,
  fills: FillParams,
  split: string,
): BacktestResult {
  const trades: Trade[] = [];
  const brierRows: BrierRow[] = [];
  const perCity = venues.map((v) => eventViews(v, model, fills));
  const ordered = perCity.flat().sort((a, b) => a.event.date.localeCompare(b.event.date));
  for (const view of ordered) {
    for (const s of strategies) {
      for (const o of s.decide(view)) {
        const t = fill(s.name, view.event, o, fills);
        if (t) trades.push(t);
      }
    }
  }
  venues.forEach((v, i) => {
    for (const lead of LEAD_NAMES) brierRows.push({ venue: v.venue, cityId: v.city.id, ...brier(perCity[i]!, lead) });
  });

  const summary: BacktestResult['summary'] = {};
  const byCity: BacktestResult['byCity'] = {};
  for (const s of strategies) {
    const mine = trades.filter((t) => t.strategy === s.name);
    summary[s.name] = {
      all: stats(mine),
      train: stats(mine.filter((t) => t.date < split)),
      test: stats(mine.filter((t) => t.date >= split)),
    };
    const cities: Record<string, Stats> = {};
    for (const v of venues) {
      const key = `${v.venue}:${v.city.id}`;
      cities[key] = stats(mine.filter((t) => t.venue === v.venue && t.cityId === v.city.id));
    }
    byCity[s.name] = cities;
  }
  return { trades, summary, byCity, brier: brierRows };
}
