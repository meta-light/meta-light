import { fetchCoinmetrics } from '../data/coinmetrics';
import { alignAsOf, type SeriesPoint } from '../strategies/engine/index';
import { sma } from '../strategies/engine/data';
import { daysSinceHigh, puellMultiple, rollingCorr } from './indicators';
import { createFetchSeries, SERIES, type SeriesName } from './series';

// bun src/trading/cycle/cli.ts [--json]
// Where BTC sits against the cycle-bottom markers from 100y's "Generational BTC Buy Is Coming".

const WEEKS = { '200W': 1400, '300W': 2100, '350W': 2450 } as const;
// Coin Metrics daily closes: 2013-12-04→2015-01-14, 2017-12-16→2018-12-15, 2021-11-08→2022-11-09.
const TOP_TO_BOTTOM_DAYS = [406, 364, 366];

export interface Snapshot {
  date: string;
  price: number;
  sma: Record<keyof typeof WEEKS, { value: number; distance: number }>;
  ath: { price: number; date: string; daysSince: number; drawdown: number };
  mvrv: number;
  realizedPrice: number;
  priceAtMvrv08: number;
  puell: number;
  fearGreed: number;
  m2: number;
  btcM2Corr365: number;
  bottomScore: { hits: number; of: number; flags: Record<string, boolean | null> };
}

export function snapshot(dates: string[], prices: number[], series: Record<SeriesName, SeriesPoint[]>): Snapshot {
  const at = (name: SeriesName) => alignAsOf(dates, series[name]);
  const last = prices.length - 1;
  const price = prices[last]!;
  const sinceHigh = daysSinceHigh(prices);
  const athIdx = last - sinceHigh[last]!;
  const smas = Object.fromEntries(
    Object.entries(WEEKS).map(([k, p]) => {
      const value = sma(prices, p)[last]!;
      return [k, { value, distance: price / value - 1 }];
    }),
  ) as Snapshot['sma'];
  const mvrv = at('mvrv')[last]!;
  const realizedPrice = price / mvrv;
  const puell = puellMultiple(at('miner_revenue'))[last]!;
  const fearGreed = at('fear_greed')[last]!;
  const m2 = at('m2');
  const corr = rollingCorr(prices.map(Math.log), m2.map(Math.log), 365)[last]!;

  const flags: Record<string, boolean | null> = {
    'price < 200W SMA': known(smas['200W'].value, price < smas['200W'].value),
    'MVRV < 1': known(mvrv, mvrv < 1),
    'Puell < 0.5': known(puell, puell < 0.5),
    'Fear & Greed < 20': known(fearGreed, fearGreed < 20),
  };
  const live = Object.values(flags).filter((v) => v !== null);
  return {
    date: dates[last]!,
    price,
    sma: smas,
    ath: { price: prices[athIdx]!, date: dates[athIdx]!, daysSince: sinceHigh[last]!, drawdown: price / prices[athIdx]! - 1 },
    mvrv,
    realizedPrice,
    priceAtMvrv08: 0.8 * realizedPrice,
    puell,
    fearGreed,
    m2: m2[last]!,
    btcM2Corr365: corr,
    bottomScore: { hits: live.filter(Boolean).length, of: live.length, flags },
  };
}

const known = (v: number, hit: boolean): boolean | null => (Number.isFinite(v) ? hit : null);

const usd = (x: number): string =>
  Number.isFinite(x) ? `$${Math.round(x).toLocaleString('en-US')}` : '—';
const pct = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%` : '—');
const fix = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : '—');

function render(s: Snapshot): string {
  const avg = Math.round(TOP_TO_BOTTOM_DAYS.reduce((a, b) => a + b, 0) / TOP_TO_BOTTOM_DAYS.length);
  const rows: [string, string][] = [
    ['BTC', `${usd(s.price)}  (${s.date})`],
    ...Object.entries(s.sma).map(([k, v]): [string, string] => [`${k} SMA`, `${usd(v.value)}  price ${pct(v.distance)}`]),
    ['ATH', `${usd(s.ath.price)} on ${s.ath.date}, ${pct(s.ath.drawdown)} since`],
    ['Days since ATH', `${s.ath.daysSince}  (past tops bottomed after ${TOP_TO_BOTTOM_DAYS.join(' / ')}, avg ${avg})`],
    ['MVRV', fix(s.mvrv)],
    ['Realized price', usd(s.realizedPrice)],
    ['Price at MVRV 0.8', usd(s.priceAtMvrv08)],
    ['Puell multiple', fix(s.puell)],
    ['Fear & Greed', fix(s.fearGreed, 0)],
    ['US M2 (lagged)', `$${fix(s.m2 / 1000, 2)}T`],
    ['BTC–M2 corr (365d)', fix(s.btcM2Corr365)],
    ['Bottom score', `${s.bottomScore.hits}/${s.bottomScore.of}`],
    ...Object.entries(s.bottomScore.flags).map(([k, v]): [string, string] => [`  ${k}`, v === null ? 'n/a' : v ? 'yes' : 'no']),
  ];
  const w = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => `${k.padEnd(w)}  ${v}`).join('\n');
}

async function main(): Promise<void> {
  const fetchSeries = createFetchSeries();
  const [rows, ...lists] = await Promise.all([
    fetchCoinmetrics('BTC-USD', '1d', 0, Date.now()),
    ...SERIES.map((n) => fetchSeries(n)),
  ]);
  const series = Object.fromEntries(SERIES.map((n, i) => [n, lists[i]!])) as Record<SeriesName, SeriesPoint[]>;
  const dates = rows.map((r) => new Date(r[0]).toISOString().slice(0, 10));
  const s = snapshot(dates, rows.map((r) => r[4]), series);
  console.log(process.argv.includes('--json') ? JSON.stringify(s, null, 2) : render(s));
}

if (import.meta.main) await main();
