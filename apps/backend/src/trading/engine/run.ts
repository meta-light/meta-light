import {
  pctChange,
  type CommissionScheme,
  type SlippageModel,
  type StrategyConfig,
} from '../strategies/core/index';
import {
  Backtester,
  type BacktesterOptions,
  type BacktestResult,
  BarData,
  type DataBar,
} from '../strategies/engine/index';
import { getContractSpec } from '../strategies/engine/execution/contract-spec';
import { toMs } from '../strategies/engine/metrics/series';
import { createFetchSeries, type FetchSeries } from '../cycle/series';
import { getStrategy, type StrategyEntry } from './registry';

export interface BarRequest {
  asset: string;
  start: string;
  end: string;
  interval: string;
}

export type FetchBars = (request: BarRequest) => Promise<DataBar[]>;

export interface RunOptions {
  strategy: string;
  assets?: string[];
  start?: string;
  end?: string;
  interval?: string;
  capital?: number;
  bars?: Record<string, readonly DataBar[]>;
  fetchBars?: FetchBars;
  fetchSeries?: FetchSeries;
  costs?: { commission?: CommissionScheme; slippage?: SlippageModel };
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

  const loaded = await loadBars(assets, { start, end, interval }, options);
  const data = new BarData(loaded.bars, config.indicators);
  await addSeries(data, config, interval, options.fetchSeries);

  const benchmark = data.getFeature('adj_close').col(assets[0]!);
  const backtester = new Backtester(entry.create(config), data, {
    benchmarkReturns: { index: data.dates, values: pctChange(benchmark) },
    periodsPerYear: periodsPerYear(interval, assets),
    ...options.backtester,
  });
  const result = backtester.run();
  result.warnings.unshift(
    ...assetClassWarnings(entry, assets),
    ...loaded.warnings,
    ...warmupWarnings(config, data.dates.length),
  );
  return { strategy: entry.id, config, result };
}

async function addSeries(
  data: BarData,
  config: StrategyConfig,
  interval: string,
  fetchSeries?: FetchSeries,
): Promise<void> {
  if (!config.series?.length) return;
  // Series are stamped by day; on intraday bars an as-of join would leak a value before it was published.
  if (/^\d+(m|h)$/i.test(interval.trim()))
    throw new Error(`Series ${config.series.join(', ')} need daily bars, got ${interval}`);
  const fetch = fetchSeries ?? createFetchSeries();
  for (const name of config.series) data.addSeries(name, await fetch(name));
}

function warmupWarnings(config: StrategyConfig, bars: number): string[] {
  const longest = Math.max(0, ...(config.indicators ?? []).flatMap((s) => s.params.periods));
  return longest >= bars
    ? [`Longest indicator window (${longest}) is not shorter than the ${bars} loaded bars; its signals never form`]
    : [];
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
    ...(options.costs?.commission && { commission: options.costs.commission }),
    ...(options.costs?.slippage && { slippage: options.costs.slippage }),
  };
}

async function loadBars(
  assets: string[],
  period: Omit<BarRequest, 'asset'>,
  options: RunOptions,
): Promise<{ bars: Record<string, DataBar[]>; warnings: string[] }> {
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
  const inPeriod = assets.map((asset, i) => {
    const list = lists[i]!.filter((b) => {
      const t = toMs(b.timestamp);
      return t >= from && t < to;
    });
    if (!list.length)
      throw new Error(
        `No bars for ${asset} between ${period.start} and ${period.end}`,
      );
    return list;
  });

  const firsts = inPeriod.map((list) => toMs(list[0]!.timestamp));
  const common = Math.max(...firsts);
  const warnings: string[] = [];
  if (firsts.some((t) => t < common)) {
    const late = assets.filter((_, i) => firsts[i] === common);
    warnings.push(
      `Trimmed start to ${inPeriod[firsts.indexOf(common)]![0]!.timestamp}, when ${late.join(', ')} first has data`,
    );
  }
  return {
    bars: Object.fromEntries(
      assets.map((asset, i) => [
        asset,
        inPeriod[i]!.filter((b) => toMs(b.timestamp) >= common),
      ]),
    ),
    warnings,
  };
}

const MINUTES = { m: 1, h: 60, d: 1440 } as const;

export function periodsPerYear(interval: string, assets: string[]): number {
  const m = /^(\d+)(m|h|d|wk?|mo)$/.exec(interval.trim().toLowerCase());
  if (!m) return 252;
  const n = Number(m[1]);
  const unit = m[2]!;
  if (unit === 'mo') return Math.max(1, Math.round(12 / n));
  if (unit === 'w' || unit === 'wk') return Math.max(1, Math.round(52 / n));
  const minutes = n * MINUTES[unit as keyof typeof MINUTES];
  const crypto = assets.every((a) => getContractSpec(a).assetClass === 'crypto');
  const [days, minutesPerDay] = crypto ? [365, 1440] : [252, 390];
  return Math.max(1, Math.round(days * Math.max(1, minutesPerDay / minutes)));
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
