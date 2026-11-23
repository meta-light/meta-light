import { runStrategy } from '../engine/run';
import { Frame } from '../strategies/core/index';
import { BarData, type DataBar, type SeriesPoint } from '../strategies/engine/index';
import { MaRegimeGate } from '../strategies/engine/risk/index';
import { snapshot } from './cli';
import { daysSinceHigh, holdUntil, puellMultiple, rollingCorr } from './indicators';
import { createFetchSeries, m2FromCsv } from './series';
import type { KvStore } from '../store';

const DAY = 86_400_000;
const day = (i: number, from = '2020-01-01'): string =>
  new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10);
const bars = (prices: number[], from?: string): DataBar[] =>
  prices.map((p, i) => ({ timestamp: day(i, from), open: p, high: p, low: p, close: p }));

describe('series alignment', () => {
  it('joins as of each bar and is NaN before the first point', () => {
    const data = new BarData({ 'BTC-USD': bars([1, 2, 3, 4, 5]) });
    data.addSeries('x', [
      ['2020-01-04', 40],
      ['2020-01-02', 20],
    ]);
    expect(data.getFeature('x').col('BTC-USD')).toEqual([NaN, 20, 20, 40, 40]);
  });

  it('dates M2 to the first of the month after publication', () => {
    const csv = 'observation_date,M2SL\n2024-01-01,20800.1\n2024-11-01,21447.6\n2024-12-01,.\n';
    expect(m2FromCsv(csv)).toEqual([
      ['2024-03-01', 20800.1],
      ['2025-01-01', 21447.6],
    ]);
  });
});

describe('createFetchSeries', () => {
  const memStore = (): KvStore & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return {
      map,
      get: async (k) => map.get(k) ?? null,
      put: async (k, v) => void map.set(k, v),
    } as KvStore & { map: Map<string, string> };
  };

  it('caches for 12h and falls back to stale data when the source fails', async () => {
    const store = memStore();
    let now = 0;
    let calls = 0;
    let fail = false;
    const fetch = createFetchSeries(store, () => now, {
      mvrv: async () => {
        calls++;
        if (fail) throw new Error('down');
        return [['2024-01-01', calls]];
      },
    });
    expect(await fetch('mvrv')).toEqual([['2024-01-01', 1]]);
    now = 11 * 3_600_000;
    expect(await fetch('mvrv')).toEqual([['2024-01-01', 1]]);
    expect(calls).toBe(1);
    now = 13 * 3_600_000;
    fail = true;
    expect(await fetch('mvrv')).toEqual([['2024-01-01', 1]]);
    expect(calls).toBe(2);
    await expect(fetch('nope')).rejects.toThrow(/Unknown series/);
  });
});

describe('cycle indicators', () => {
  it('counts bars since the running high', () => {
    expect(daysSinceHigh([NaN, 1, 3, 2, 1, 4])).toEqual([NaN, 0, 0, 1, 2, 0]);
  });

  it('divides revenue by its trailing mean', () => {
    expect(puellMultiple([1, 1, 4], 3).map((v) => +v.toFixed(3))).toEqual([NaN, NaN, 2]);
  });

  it('correlates over a full window only', () => {
    const r = rollingCorr([1, 2, 3, 4], [2, 4, 6, 1], 3);
    expect(r[1]).toBeNaN();
    expect(r[2]).toBeCloseTo(1);
    expect(r[3]).toBeLessThan(0);
  });

  it('ratchets exposure up and holds it until the exit fires', () => {
    const entry = [0, 0.5, 0, 1, 0, 0, 0.5];
    const exit = [false, false, false, false, false, true, false];
    expect(holdUntil(entry, exit)).toEqual([0, 0.5, 0.5, 1, 1, 0, 0.5]);
  });
});

describe('MaRegimeGate', () => {
  it('zeroes longs while price is stretched above its SMA', () => {
    const prices = [1, 1, 1, 3, 3, 1];
    const idx = prices.map((_, i) => day(i));
    const returns = new Frame(idx, ['A'], prices.map((p, i) => [i ? p / prices[i - 1]! - 1 : 0]));
    const weights = new Frame(idx, ['A'], prices.map(() => [1]));
    const out = new MaRegimeGate({ period: 3, maxPremium: 0.5 }).adjust(weights, returns);
    // SMA3 at i=3 is 5/3, 3 > 2.5 → gated; at i=4 SMA is 7/3, 3 < 3.5 → open.
    expect(out.col('A')).toEqual([1, 1, 1, 0, 1, 1]);
  });
});

describe('cycle strategies', () => {
  // Price falls 80% then recovers 10x, so MVRV-style series and the 200W SMA both trigger.
  const n = 1800;
  const prices = Array.from({ length: n }, (_, i) =>
    i < 1500 ? 100 : i < 1600 ? 100 - (i - 1500) * 0.8 : 20 + (i - 1600) * 2,
  );
  const series = async (name: string): Promise<SeriesPoint[]> =>
    prices.map((p, i) => [day(i), name === 'mvrv' ? p / 40 : name === 'fear_greed' ? (p < 30 ? 10 : 50) : 1]);

  it.each(['wma-accumulation', 'mvrv-accumulation', 'cycle-confluence'])(
    '%s buys the drawdown and exits into the rally',
    async (id) => {
      const { result } = await runStrategy({
        strategy: id,
        start: day(0),
        end: day(n),
        bars: { 'BTC-USD': bars(prices) },
        fetchSeries: series,
      });
      const w = result.positions.col('BTC-USD');
      expect(w.slice(0, 1400).every((v) => v === 0), 'flat before the crash').toBe(true);
      expect(Math.max(...w.slice(1550, 1650)), 'long near the low').toBeGreaterThan(0);
      expect(w.at(-1), 'out after the rally').toBe(0);
    },
  );

  it('refuses series on intraday bars', async () => {
    await expect(
      runStrategy({ strategy: 'mvrv-accumulation', interval: '1h', bars: { 'BTC-USD': bars([1]) }, fetchSeries: series }),
    ).rejects.toThrow(/daily bars/);
  });
});

describe('snapshot', () => {
  it('reports realized price, distances and the bottom score', () => {
    const p = Array.from({ length: 2500 }, (_, i) => (i === 2000 ? 200 : 100));
    const dates = p.map((_, i) => day(i, '2015-01-01'));
    const flat = (v: number): SeriesPoint[] => [[dates[0]!, v]];
    const s = snapshot(dates, p, { mvrv: flat(0.9), fear_greed: flat(15), m2: flat(21000), miner_revenue: flat(1) });
    expect(s.realizedPrice).toBeCloseTo(100 / 0.9);
    expect(s.priceAtMvrv08).toBeCloseTo(80 / 0.9);
    expect(s.ath).toMatchObject({ price: 200, daysSince: 499, drawdown: -0.5 });
    expect(s.bottomScore.flags).toMatchObject({ 'MVRV < 1': true, 'Fear & Greed < 20': true, 'Puell < 0.5': false });
  });
});
