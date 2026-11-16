import type { BarRequest, FetchBars } from '../engine/run';
import { toMs } from '../strategies/engine/metrics/series';
import { fetchBinance } from './binance';
import { type RangeFetcher, withMonthCache } from './cache';
import { fetchCoinbase } from './coinbase';
import { fetchCoingecko } from './coingecko';
import { intervalMs, type Row, toBar } from './interval';

export type Source = 'binance' | 'coinbase' | 'coingecko';
export const SOURCES: readonly Source[] = ['binance', 'coinbase', 'coingecko'];

const FETCHERS: Record<Source, RangeFetcher> = {
  binance: fetchBinance,
  coinbase: fetchCoinbase,
  coingecko: fetchCoingecko,
};

export interface FetchNote {
  asset: string;
  interval: string;
  source: Source;
  bars: number;
  filled: number;
  synthesizedOhlc: boolean;
}

export interface CreateFetchBarsOptions {
  source?: Source;
  cacheDir?: string;
  fetchRange?: RangeFetcher;
  onFetch?: (note: FetchNote) => void;
}

export function createFetchBars(options: CreateFetchBarsOptions = {}): FetchBars {
  const source = options.source ?? 'binance';
  const fetchRange =
    options.fetchRange ??
    withMonthCache(source, FETCHERS[source], options.cacheDir);
  return async ({ asset, start, end, interval }: BarRequest) => {
    const raw = await fetchRange(asset, interval, toMs(start), toMs(end));
    const { rows, filled } = fillGaps(raw, intervalMs(interval));
    options.onFetch?.({
      asset,
      interval,
      source,
      bars: rows.length,
      filled,
      synthesizedOhlc: source === 'coingecko',
    });
    return rows.map((r) => toBar(r, interval));
  };
}

export function fillGaps(input: readonly Row[], step: number): { rows: Row[]; filled: number } {
  const sorted = [...input].sort((a, b) => a[0] - b[0]);
  const rows: Row[] = [];
  let filled = 0;
  for (const r of sorted) {
    const prev = rows[rows.length - 1];
    if (prev && r[0] <= prev[0]) continue;
    if (prev)
      for (let t = prev[0] + step; t < r[0]; t += step) {
        const c = rows[rows.length - 1]![4];
        rows.push([t, c, c, c, c, 0]);
        filled++;
      }
    rows.push(r);
  }
  return { rows, filled };
}
