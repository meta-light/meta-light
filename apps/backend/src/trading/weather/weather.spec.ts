import { describe, expect, it } from 'vitest';
import { BIN_EDGES, binLabel, binOf, Calibrator } from './calibration';
import { cityById } from './cities';
import { buyPrice, fill, kalshiFee, midAt, polymarketFee, quoteAt, stats, type Trade } from './engine';
import { forecastMax, issuedBy, type ForecastSeries } from './forecasts';
import { eventDate, strikeRange } from './kalshi';
import { bucketProbs, DEFAULT_MODEL, residuals, type CityData } from './model';
import { parseTitle } from './polymarket';
import { addDays, dayMs, stdDayWindow, zonedMs } from './time';
import type { Bucket, MarketEvent, Quote } from './types';

const H = 3_600_000;
const D = 24 * H;
const utc = (s: string) => Date.parse(s);

describe('venue parsing', () => {
  it('reads Kalshi event dates and strikes', () => {
    expect(eventDate('KXHIGHNY-25NOV15')).toBe('2025-11-15');
    expect(eventDate('KXHIGHNY-25XYZ15')).toBeNull();
    expect(strikeRange({ strike_type: 'greater', floor_strike: 77, cap_strike: null })).toEqual([78, Infinity]);
    expect(strikeRange({ strike_type: 'less', floor_strike: null, cap_strike: 49 })).toEqual([-Infinity, 48]);
    expect(strikeRange({ strike_type: 'between', floor_strike: 55, cap_strike: 56 })).toEqual([55, 56]);
    expect(strikeRange({ strike_type: 'between', floor_strike: 55, cap_strike: null })).toBeNull();
  });

  it('reads Polymarket bucket titles', () => {
    expect(parseTitle('39°F or below')).toEqual([-Infinity, 39]);
    expect(parseTitle('92°F or higher')).toEqual([92, Infinity]);
    expect(parseTitle('82-83°F')).toEqual([82, 83]);
    expect(parseTitle('75°F')).toEqual([75, 75]);
    expect(parseTitle('24°C')).toBeNull();
  });
});

describe('fees', () => {
  it('rounds the Kalshi fee up to the cent', () => {
    expect(kalshiFee(10, 0.5)).toBe(0.18);
    expect(kalshiFee(1, 0.5)).toBe(0.02);
    expect(kalshiFee(100, 0.5)).toBe(1.75);
  });
  it('charges Polymarket rate × p × (1 − p) per contract', () => {
    expect(polymarketFee(10, 0.5, 0.02)).toBeCloseTo(0.05);
    expect(polymarketFee(10, 0.5, 0)).toBe(0);
  });
});

describe('time', () => {
  it('converts local wall-clock to UTC across DST', () => {
    expect(zonedMs('2026-01-15', 12, 'America/New_York')).toBe(utc('2026-01-15T17:00:00Z'));
    expect(zonedMs('2026-07-01', 12, 'America/New_York')).toBe(utc('2026-07-01T16:00:00Z'));
    expect(zonedMs('2026-03-08', 12, 'America/New_York')).toBe(utc('2026-03-08T16:00:00Z'));
  });
  it('uses local standard time for the NWS climate day, even in summer', () => {
    expect(stdDayWindow('2026-07-01', -5)).toEqual([utc('2026-07-01T05:00:00Z'), utc('2026-07-02T05:00:00Z')]);
  });
});

describe('forecasts without look-ahead', () => {
  it('waits for the 00Z run to be out before an early-hour forecast counts', () => {
    const h = utc('2026-07-02T02:00:00Z');
    expect(issuedBy(h, 1)).toBe(h - D + 4 * H);
    const noon = utc('2026-07-02T12:00:00Z');
    expect(issuedBy(noon, 2)).toBe(noon - 2 * D);
  });

  it('uses the shortest lead published by asOf and never a later one', () => {
    const t = utc('2026-07-02T12:00:00Z');
    const f: ForecastSeries = { times: [t], byLead: { 1: [80], 2: [75], 3: [70] } };
    expect(forecastMax(f, t, t + H, t - D)).toBe(80);
    expect(forecastMax(f, t, t + H, t - D - 1)).toBe(75);
    expect(forecastMax(f, t, t + H, t - 3 * D - 1)).toBeNull();
    const gap: ForecastSeries = { times: [t], byLead: { 1: [null], 2: [75], 3: [70] } };
    expect(forecastMax(gap, t, t + H, t)).toBe(75);
  });
});

describe('fills', () => {
  const quotes: Quote[] = [
    { t: 0, bid: 0.3, ask: 0.34 },
    { t: 10 * H, bid: null, ask: 0.04 },
  ];

  it('takes the latest quote at or before t, unless stale', () => {
    expect(quoteAt(quotes, 5 * H, 6 * H)).toBe(quotes[0]);
    expect(quoteAt(quotes, 7 * H, 6 * H)).toBeNull();
    expect(quoteAt(quotes, -1, 6 * H)).toBeNull();
    expect(quoteAt(quotes, 10 * H, 6 * H)).toBe(quotes[1]);
  });

  it('buys YES at the ask and NO at 1 − bid, with a half-spread only on Polymarket', () => {
    const q = quotes[0]!;
    expect(buyPrice(q, 'yes', 'kalshi', 0.01)).toBe(0.34);
    expect(buyPrice(q, 'no', 'kalshi', 0.01)).toBe(0.7);
    expect(buyPrice(q, 'yes', 'polymarket', 0.01)).toBe(0.35);
    expect(buyPrice(q, 'no', 'polymarket', 0.01)).toBe(0.71);
    expect(buyPrice(quotes[1]!, 'no', 'kalshi', 0)).toBeNull();
    expect(buyPrice({ t: 0, bid: 0.995, ask: 0.995 }, 'yes', 'kalshi', 0)).toBeNull();
  });

  it('treats an empty side as 0 or 1 for the mid', () => {
    expect(midAt(quotes, 0, H)).toBeCloseTo(0.32);
    expect(midAt(quotes, 10 * H, H)).toBeCloseTo(0.02);
    expect(midAt([{ t: 0, bid: null, ask: null }], 0, H)).toBeNull();
  });

  it('sizes, charges and settles a Kalshi trade, and refuses after close', () => {
    const bucket: Bucket = { id: 'b', label: '72-73', lo: 72, hi: 73, result: 1, quotes: [{ t: 0, bid: 0.38, ask: 0.4 }] };
    const ev: MarketEvent = {
      venue: 'kalshi', cityId: 'nyc', date: '2026-07-01', closeMs: 2 * H, buckets: [bucket], fee: { venue: 'kalshi', rate: 0.07 }, settledHigh: 72,
    };
    const p = { stake: 10, maxStaleMs: 6 * H, halfSpread: 0.01 };
    const t = fill('s', ev, { bucket, side: 'yes', t: H }, p)!;
    expect(t.contracts).toBe(25);
    expect(t.fee).toBe(0.42);
    expect(t.pnl).toBeCloseTo(25 - 10 - 0.42);
    expect(fill('s', ev, { bucket, side: 'no', t: H }, p)!.pnl).toBeCloseTo(-Math.floor(10 / 0.62) * 0.62 - kalshiFee(16, 0.62));
    expect(fill('s', ev, { bucket, side: 'yes', t: 2 * H }, p)).toBeNull();
  });
});

describe('model', () => {
  const buckets = [
    { lo: -Infinity, hi: 69 },
    { lo: 70, hi: 71 },
    { lo: 72, hi: 73 },
    { lo: 74, hi: Infinity },
  ];

  it('gives probabilities that sum to 1 and peak at the predictor', () => {
    const p = bucketProbs(buckets, { x: 72.5, floor: null }, [-1, 0, 1], 1);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.max(...p)).toBe(p[2]);
  });

  it('zeroes buckets below the observed floor', () => {
    const p = bucketProbs(buckets, { x: 70, floor: 72 }, [-2, 0, 2], 1);
    expect(p[0]).toBe(0);
    expect(p[1]).toBe(0);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('only uses errors from days already settled and published at the decision time', () => {
    const date = '2026-07-20';
    const start = dayMs(addDays(date, -20));
    const times: number[] = [];
    for (let t = start; t < dayMs(addDays(date, 2)); t += H) times.push(t);
    const flat = times.map(() => 70);
    const actuals = new Map<string, number>();
    for (let k = 1; k <= 20; k++) actuals.set(addDays(date, -k), 72);
    actuals.set(addDays(date, -1), 1000);
    actuals.set(date, 1000);
    const d: CityData = {
      city: cityById('nyc'),
      venue: 'kalshi',
      forecast: { times, byLead: { 1: flat, 2: flat, 3: flat } },
      obs: [],
      actuals,
    };
    const res = residuals(d, date, 'd-1', { ...DEFAULT_MODEL, window: 10 }, new Map());
    expect(res).toHaveLength(10);
    expect(res.every((r) => r === 2)).toBe(true);
  });
});

describe('stats', () => {
  const trade = (date: string, pnl: number): Trade => ({
    strategy: 's', venue: 'kalshi', cityId: 'nyc', date, bucket: 'b', side: 'yes', t: 0, price: 0.5, contracts: 20, fee: 0, pnl, won: pnl > 0,
  });

  it('measures drawdown on cumulative daily P&L', () => {
    const s = stats([trade('2026-01-04', 10), trade('2026-01-01', 5), trade('2026-01-02', -3), trade('2026-01-03', -4)]);
    expect(s.pnl).toBe(8);
    expect(s.maxDrawdown).toBe(7);
    expect(s.staked).toBe(40);
    expect(s.roi).toBe(0.2);
    expect(s.winRate).toBe(0.5);
    expect(s.days).toBe(4);
  });
});

describe('calibration', () => {
  it('bins mids by upper edge', () => {
    expect(binOf(0)).toBe(0);
    expect(binOf(0.019)).toBe(0);
    expect(binOf(0.02)).toBe(1);
    expect(binOf(0.55)).toBe(BIN_EDGES.indexOf(0.6));
    expect(binOf(1)).toBe(BIN_EDGES.length - 1);
    expect(binLabel(0)).toBe('0-0.02');
  });

  it('only uses events settled settleDays before the queried date', () => {
    const cal = new Calibrator(0, 2, 2);
    cal.observe('kalshi', 'd-1', '2025-03-01', 0.3, 1);
    cal.observe('kalshi', 'd-1', '2025-03-01', 0.3, 1);
    cal.observe('kalshi', 'd-1', '2025-03-02', 0.3, 0);
    expect(cal.prob('kalshi', 'd-1', '2025-03-02', 0.3)).toBeNull();
    expect(cal.prob('kalshi', 'd-1', '2025-03-03', 0.3)).toBe(1);
    expect(cal.prob('kalshi', 'd-1', '2025-03-04', 0.3)).toBeCloseTo(2 / 3);
    expect(cal.prob('kalshi', 'd-1', '2025-03-04', 0.5)).toBeNull();
    expect(cal.prob('polymarket', 'd-1', '2025-03-04', 0.3)).toBeNull();
  });

  it('shrinks toward the bin mean price', () => {
    const cal = new Calibrator(2, 2, 2);
    cal.observe('kalshi', 'd-1', '2025-03-01', 0.25, 1);
    cal.observe('kalshi', 'd-1', '2025-03-01', 0.25, 1);
    expect(cal.prob('kalshi', 'd-1', '2025-03-05', 0.25)).toBeCloseTo((2 + 2 * 0.25) / 4);
  });
});
