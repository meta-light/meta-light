import { pctChange, type StrategyConfig } from '../strategies/core/index';
import {
  Backtester,
  type BacktesterOptions,
  type BacktestResult,
  BarData,
  type DataBar,
} from '../strategies/engine/index';
import { toMs } from '../strategies/engine/metrics/series';
import { getStrategy, type StrategyEntry } from './registry';

export interface BarRequest {
  asset: string;
  start: string;
  end: string;
  interval: string;
}

/** `end` is exclusive. */
export type FetchBars = (request: BarRequest) => Promise<DataBar[]>;

export interface RunOptions {
  strategy: string;
  /** The first asset is the benchmark. */
  assets?: string[];
  /** Inclusive start date; defaults to the template's. */
  start?: string;
  /** Exclusive end date; defaults to the template's. */
  end?: string;
  interval?: string;
  capital?: number;
  /** Takes precedence over `fetchBars`. */
  bars?: Record<string, readonly DataBar[]>;
  fetchBars?: FetchBars;
  backtester?: BacktesterOptions;
}

export interface RunResult {
  strategy: string;
  config: StrategyConfig;
  result: BacktestResult;
}

export async function runStrategy(options: RunOptions): Promise<RunResult> {
  const entry = getStrategy(options.strategy);
  const assets = resolveAssets(entry, options.assets);
  const config = withOverrides(entry, assets, options);
  const { start, end } = config.backtestPeriod;
  const interval = config.granularity ?? '1d';

  const bars = await loadBars(assets, { start, end, interval }, options);
  const data = new BarData(bars, config.indicators);

  const benchmark = data.getFeature('adj_close').col(assets[0]!);
  const backtester = new Backtester(entry.create(config), data, {
    benchmarkReturns: { index: data.dates, values: pctChange(benchmark) },
    ...options.backtester,
  });
  const result = backtester.run();
  result.warnings.unshift(...assetClassWarnings(entry, assets));
  return { strategy: entry.id, config, result };
}

function resolveAssets(entry: StrategyEntry, requested?: string[]): string[] {
  const assets = requested ?? entry.config.instruments;
  const { id, minAssets, maxAssets, fixedUniverse } = entry;
  if (!assets.length) throw new Error(`${id}: no assets given`);
  if (new Set(assets).size !== assets.length)
    throw new Error(`${id}: duplicate assets in ${assets.join(', ')}`);
  if (fixedUniverse && !sameSet(assets, entry.config.instruments))
    throw new Error(
      `${id} trades a fixed universe (${entry.config.instruments.join(', ')}); it cannot run on other assets`,
    );
  if (assets.length < minAssets)
    throw new Error(
      `${id} needs at least ${minAssets} assets, got ${assets.length}`,
    );
  if (maxAssets !== undefined && assets.length > maxAssets)
    throw new Error(
      `${id} uses at most ${maxAssets} assets, got ${assets.length}`,
    );
  return [...assets];
}

function withOverrides(
  entry: StrategyEntry,
  assets: string[],
  options: RunOptions,
): StrategyConfig {
  const base = entry.config;
  const interval = options.interval ?? base.granularity;
  return {
    ...base,
    instruments: assets,
    backtestPeriod: {
      start: options.start ?? base.backtestPeriod.start,
      end: options.end ?? base.backtestPeriod.end,
    },
    ...(interval === undefined ? {} : { granularity: interval }),
    initialCapital: options.capital ?? base.initialCapital,
    benchmarkSymbol: assets[0]!,
    benchmarkName: `${assets[0]} buy and hold`,
  };
}

async function loadBars(
  assets: string[],
  period: Omit<BarRequest, 'asset'>,
  options: RunOptions,
): Promise<Record<string, DataBar[]>> {
  const { bars, fetchBars } = options;
  if (!bars && !fetchBars)
    throw new Error(`${options.strategy}: pass either bars or fetchBars`);
  const lists = await Promise.all(
    assets.map(async (asset) => {
      if (bars) {
        const list = bars[asset];
        if (!list) throw new Error(`No bars given for ${asset}`);
        return list;
      }
      return fetchBars!({ asset, ...period });
    }),
  );
  const from = toMs(period.start);
  const to = toMs(period.end);
  return Object.fromEntries(
    assets.map((asset, i) => {
      const inPeriod = lists[i]!.filter((b) => {
        const t = toMs(b.timestamp);
        return t >= from && t < to;
      });
      if (!inPeriod.length)
        throw new Error(
          `No bars for ${asset} between ${period.start} and ${period.end}`,
        );
      return [asset, inPeriod];
    }),
  );
}

const SYMBOL_SUFFIX = { fx: '=X', futures: '=F' } as const;

function assetClassWarnings(entry: StrategyEntry, assets: string[]): string[] {
  if (!entry.assetClass) return [];
  const suffix = SYMBOL_SUFFIX[entry.assetClass];
  const off = assets.filter((a) => !a.toUpperCase().endsWith(suffix));
  return off.length
    ? [
        `${entry.id} is built for ${entry.assetClass} symbols (*${suffix}); ${off.join(', ')} will be treated as equities`,
      ]
    : [];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
