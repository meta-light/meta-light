import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFetchBars, type FetchNote, type Source, SOURCES } from './data/index';
import { DEFAULT_CACHE_DIR } from './data/cache';
import {
  blendNav,
  type ComboScore,
  combinations,
  monthStarts,
  type Objective,
  paretoFrontier,
  scoreCombo,
  yearsBetween,
} from './combine';
import { REGISTRY, type StrategyEntry } from './engine/registry';
import { type FetchBars, periodsPerYear, type RunOptions, runStrategy } from './engine/run';
import type { BacktestResult, DataBar } from './strategies/engine/index';
import { toMs } from './strategies/engine/metrics/series';

export const UNIVERSE = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

export const CRYPTO_COSTS: NonNullable<RunOptions['costs']> = {
  commission: { type: 'fixed_bps', bps: 10 },
  slippage: { type: 'fixed_bps', bps: 5 },
};

const WINDOW_DAYS: Record<string, number> = { '1m': 30, '5m': 180, '15m': 180, '30m': 180, '1h': 365 };
const DAILY_START = '2020-09-01';
const DAY = 86_400_000;

type Flags = Record<string, string | true>;

function parseArgs(argv: string[]): { cmd: string; pos: string[]; flags: Flags } {
  const pos: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { cmd: pos.shift() ?? 'help', pos, flags };
}

const str = (f: Flags, k: string): string | undefined => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
const list = (f: Flags, k: string): string[] | undefined => str(f, k)?.split(',').map((s) => s.trim().toUpperCase());
const today = (): string => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number): string => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

function source(f: Flags): Source {
  const s = (str(f, 'source') ?? 'binance') as Source;
  if (!SOURCES.includes(s)) throw new Error(`--source must be one of ${SOURCES.join(', ')}`);
  return s;
}

export function skipReason(e: StrategyEntry, assets: string[]): string | null {
  if (e.assetClass) return `built for ${e.assetClass}`;
  if (e.fixedUniverse) return `fixed universe (${e.config.instruments.join(', ')})`;
  if (assets.length < e.minAssets) return `needs ${e.minAssets}+ assets`;
  return null;
}

export const assetsFor = (e: StrategyEntry, assets: string[]): string[] =>
  e.maxAssets !== undefined ? assets.slice(0, e.maxAssets) : assets;

function defaultWindow(interval: string, flags: Flags, src: Source): { start: string; end: string } {
  const end = str(flags, 'end') ?? today();
  const fallback =
    src === 'coingecko' ? daysAgo(364) : interval === '1d' ? DAILY_START : daysAgo(WINDOW_DAYS[interval] ?? 180);
  return { start: str(flags, 'start') ?? fallback, end };
}

export interface Summary {
  strategy: string;
  assets: string[];
  interval: string;
  start: string;
  end: string;
  bars: number;
  totalReturn: number;
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  trades: number;
  costs: number;
  holdReturn: number;
  btcHoldReturn: number | null;
  warnings: string[];
}

function recordingFetch(fetchBars: FetchBars, seen: Map<string, Map<string, number>>): FetchBars {
  return async (req) => {
    const bars: DataBar[] = await fetchBars(req);
    const closes = new Map(bars.map((b) => [b.timestamp, b.close]));
    seen.set(`${req.asset}|${req.interval}`, closes);
    return bars;
  };
}

export function summarize(
  strategy: string,
  assets: string[],
  interval: string,
  result: Pick<BacktestResult, 'dates' | 'nav' | 'fills' | 'transactionCosts' | 'mode'> & {
    weights: { values: readonly (readonly number[])[] };
  },
  closes: (asset: string) => Map<string, number> | undefined,
  warnings: string[],
): Summary {
  const { dates, nav } = result;
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const total = nav[nav.length - 1]! / nav[0]! - 1;
  const years = (toMs(last) - toMs(first)) / (365.25 * DAY);
  const rets: number[] = [];
  let peak = nav[0]!;
  let maxDd = 0;
  for (let i = 1; i < nav.length; i++) {
    rets.push(nav[i]! / nav[i - 1]! - 1);
    peak = Math.max(peak, nav[i]!);
    maxDd = Math.min(maxDd, nav[i]! / peak - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const hold = (a: string): number => {
    const c = closes(a);
    const p0 = c?.get(first);
    const p1 = c?.get(last);
    return p0 && p1 ? p1 / p0 - 1 : NaN;
  };
  const holds = assets.map(hold);
  return {
    strategy,
    assets,
    interval,
    start: first,
    end: last,
    bars: dates.length,
    totalReturn: total,
    cagr: years > 0 ? (1 + total) ** (1 / years) - 1 : NaN,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(periodsPerYear(interval, assets)) : NaN,
    maxDrawdown: maxDd,
    trades: result.mode === 'orders' ? result.fills.length : entriesAndExits(result.weights.values),
    costs: result.transactionCosts.reduce((a, b) => a + b, 0) / nav[0]!,
    holdReturn: holds.reduce((a, b) => a + b, 0) / holds.length,
    btcHoldReturn: assets.includes('BTC-USD') ? hold('BTC-USD') : null,
    warnings,
  };
}

function entriesAndExits(weights: readonly (readonly number[])[]): number {
  let n = 0;
  for (let i = 1; i < weights.length; i++)
    weights[i]!.forEach((w, c) => {
      const was = Math.abs(weights[i - 1]![c]! || 0) > 1e-9;
      if (was !== Math.abs(w || 0) > 1e-9) n++;
    });
  return n;
}

export interface WindowStats {
  horizonDays: number;
  windows: number;
  median: number;
  mean: number;
  up: number;
  beatHold: number;
  medianExcess: number;
  worst: number;
  best: number;
  last: number;
  lastHold: number;
  hold: { median: number; up: number; worst: number };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function windowStats(
  dates: readonly string[],
  nav: readonly number[],
  hold: (from: string, to: string) => number,
  horizonDays: number,
  stepDays = 7,
): WindowStats | null {
  const ms = dates.map(toMs);
  const horizon = horizonDays * DAY;
  const rets: number[] = [];
  const excess: number[] = [];
  const holds: number[] = [];
  let lastHold = NaN;
  let start = dates.length - 1;
  let nextEnd = ms[ms.length - 1]!;
  for (let j = dates.length - 1; j >= 0 && ms[j]! - horizon >= ms[0]!; j--) {
    if (ms[j]! > nextEnd) continue;
    nextEnd = ms[j]! - stepDays * DAY;
    start = Math.min(start, j);
    while (start > 0 && ms[start - 1]! >= ms[j]! - horizon) start--;
    while (ms[start]! < ms[j]! - horizon) start++;
    const r = nav[j]! / nav[start]! - 1;
    const h = hold(dates[start]!, dates[j]!);
    if (!rets.length) lastHold = h;
    rets.push(r);
    holds.push(h);
    excess.push(r - h);
  }
  if (!rets.length) return null;
  return {
    horizonDays,
    windows: rets.length,
    median: median(rets),
    mean: rets.reduce((a, b) => a + b, 0) / rets.length,
    up: rets.filter((r) => r > 0).length / rets.length,
    beatHold: excess.filter((x) => x > 0).length / excess.length,
    medianExcess: median(excess),
    worst: Math.min(...rets),
    best: Math.max(...rets),
    last: rets[0]!,
    lastHold,
    hold: { median: median(holds), up: holds.filter((h) => h > 0).length / holds.length, worst: Math.min(...holds) },
  };
}

function holdFn(assets: string[], closes: (asset: string) => Map<string, number> | undefined) {
  return (from: string, to: string): number => {
    const rs = assets.map((a) => {
      const c = closes(a);
      const p0 = c?.get(from);
      const p1 = c?.get(to);
      return p0 && p1 ? p1 / p0 - 1 : NaN;
    });
    return rs.reduce((x, y) => x + y, 0) / rs.length;
  };
}

async function runOne(
  e: StrategyEntry,
  assets: string[],
  flags: Flags,
  notes: FetchNote[],
): Promise<Summary> {
  return (await runFull(e, assets, flags, notes)).summary;
}

async function runFull(
  e: StrategyEntry,
  assets: string[],
  flags: Flags,
  notes: FetchNote[],
): Promise<{ summary: Summary; result: BacktestResult; closes: (a: string) => Map<string, number> | undefined }> {
  const src = source(flags);
  const interval = str(flags, 'interval') ?? e.config.granularity ?? '1d';
  const { start, end } = defaultWindow(interval, flags, src);
  const seen = new Map<string, Map<string, number>>();
  const fetchBars = recordingFetch(
    createFetchBars({ source: src, onFetch: (n) => notes.push(n) }),
    seen,
  );
  const { result } = await runStrategy({
    strategy: e.id,
    assets,
    start,
    end,
    interval,
    capital: Number(str(flags, 'capital') ?? 100_000),
    fetchBars,
    ...(flags['template-costs'] ? {} : { costs: CRYPTO_COSTS }),
  });
  const closes = (a: string) => seen.get(`${a}|${interval}`);
  return { summary: summarize(e.id, assets, interval, result, closes, result.warnings), result, closes };
}

const pct = (x: number | null): string => (x === null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`);
const num = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '—');

function table(rows: Summary[]): string {
  const head = ['#', 'strategy', 'int', 'assets', 'from', 'total', 'CAGR', 'Sharpe', 'maxDD', 'trades', 'costs', 'hold(EW)', 'vs hold'];
  const body = rows.map((r, i) => [
    String(i + 1),
    r.strategy,
    r.interval,
    r.assets.map((a) => a.split('-')[0]).join(','),
    r.start.slice(0, 10),
    pct(r.totalReturn),
    pct(r.cagr),
    num(r.sharpe),
    pct(r.maxDrawdown),
    String(r.trades),
    pct(r.costs),
    pct(r.holdReturn),
    pct(r.totalReturn - r.holdReturn),
  ]);
  const widths = head.map((h, c) => Math.max(h.length, ...body.map((r) => r[c]!.length)));
  const line = (cells: string[]): string =>
    cells.map((v, c) => (c === 1 || c === 3 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
  return [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n');
}

function fetchSummary(notes: FetchNote[]): string[] {
  const byKey = new Map<string, FetchNote>();
  for (const n of notes) byKey.set(`${n.asset}|${n.interval}`, n);
  return [...byKey.values()]
    .filter((n) => n.filled > 0 || n.synthesizedOhlc)
    .map(
      (n) =>
        `${n.source} ${n.asset} ${n.interval}: ${n.bars} bars` +
        (n.filled ? `, ${n.filled} gaps filled at prior close` : '') +
        (n.synthesizedOhlc ? ', OHLC synthesized from closes' : ''),
    );
}

async function cmdRun(pos: string[], flags: Flags): Promise<void> {
  const id = pos[0];
  if (!id) throw new Error('usage: run <strategy> [--assets ...]');
  const e = REGISTRY.get(id);
  if (!e) throw new Error(`Unknown strategy ${id}; try "list"`);
  const assets = assetsFor(e, list(flags, 'assets') ?? UNIVERSE);
  const notes: FetchNote[] = [];
  const s = await runOne(e, assets, flags, notes);
  console.log(table([s]));
  for (const w of [...s.warnings, ...fetchSummary(notes)]) console.log(`  ! ${w}`);
}

async function cmdAll(flags: Flags): Promise<void> {
  const universe = list(flags, 'assets') ?? UNIVERSE;
  const only = str(flags, 'only')?.split(',');
  const results: Summary[] = [];
  const skipped: { strategy: string; reason: string }[] = [];
  const notes: FetchNote[] = [];
  for (const e of REGISTRY.values()) {
    if (only && !only.includes(e.id)) continue;
    const reason = skipReason(e, universe);
    if (reason) {
      skipped.push({ strategy: e.id, reason });
      continue;
    }
    const interval = str(flags, 'interval') ?? e.config.granularity ?? '1d';
    if (source(flags) === 'coingecko' && interval !== '1d') {
      skipped.push({ strategy: e.id, reason: `coingecko has no ${interval} bars` });
      continue;
    }
    process.stderr.write(`running ${e.id} (${interval})... `);
    const t0 = Date.now();
    try {
      results.push(await runOne(e, assetsFor(e, universe), flags, notes));
      process.stderr.write(`${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
    } catch (err) {
      process.stderr.write('failed\n');
      skipped.push({ strategy: e.id, reason: `error: ${(err as Error).message}` });
    }
  }
  results.sort((a, b) => (Number.isFinite(b.sharpe) ? b.sharpe : -Infinity) - (Number.isFinite(a.sharpe) ? a.sharpe : -Infinity));
  console.log(`\nSource: ${source(flags)}  costs: ${flags['template-costs'] ? 'template' : '10bps commission + 5bps slippage'}  ranked by Sharpe\n`);
  console.log(table(results));
  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  ${s.strategy}: ${s.reason}`);
  }
  const data = fetchSummary(notes);
  if (data.length) {
    console.log('\nData:');
    for (const d of data) console.log(`  ${d}`);
  }
  const dir = join(DEFAULT_CACHE_DIR, 'results');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify({ source: source(flags), universe, results, skipped, data }, null, 2));
  console.log(`\nWrote ${file}`);
}

function windowTable(rows: { strategy: string; interval: string; w: WindowStats }[]): string {
  const head = ['#', 'strategy', 'int', 'windows', 'median', 'mean', '% up', '% > hold', 'med vs hold', 'worst', 'best', 'latest', 'latest hold'];
  const body = rows.map(({ strategy, interval, w }, i) => [
    String(i + 1),
    strategy,
    interval,
    String(w.windows),
    pct(w.median),
    pct(w.mean),
    `${Math.round(w.up * 100)}%`,
    `${Math.round(w.beatHold * 100)}%`,
    pct(w.medianExcess),
    pct(w.worst),
    pct(w.best),
    pct(w.last),
    pct(w.lastHold),
  ]);
  const widths = head.map((h, c) => Math.max(h.length, ...body.map((r) => r[c]!.length)));
  const line = (cells: string[]): string =>
    cells.map((v, c) => (c === 1 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
  return [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n');
}

async function cmdWindows(flags: Flags): Promise<void> {
  const universe = list(flags, 'assets') ?? UNIVERSE;
  const only = str(flags, 'only')?.split(',');
  const horizons = (str(flags, 'horizons') ?? '91,7').split(',').map(Number);
  const step = Number(str(flags, 'step') ?? 7);
  const rows: { strategy: string; interval: string; assets: number; stats: WindowStats[] }[] = [];
  const notes: FetchNote[] = [];
  for (const e of REGISTRY.values()) {
    if (only && !only.includes(e.id)) continue;
    if (skipReason(e, universe)) continue;
    const interval = str(flags, 'interval') ?? e.config.granularity ?? '1d';
    if (source(flags) === 'coingecko' && interval !== '1d') continue;
    process.stderr.write(`running ${e.id} (${interval})... `);
    try {
      const assets = assetsFor(e, universe);
      const { result, closes } = await runFull(e, assets, flags, notes);
      const hold = holdFn(assets, closes);
      const stats = horizons.map((h) => windowStats(result.dates, result.nav, hold, h, step)).filter((s) => s !== null);
      rows.push({ strategy: e.id, interval, assets: assets.length, stats });
      process.stderr.write('ok\n');
    } catch (err) {
      process.stderr.write(`failed: ${(err as Error).message}\n`);
    }
  }
  console.log(`\nSource: ${source(flags)}  costs: ${flags['template-costs'] ? 'template' : '10bps + 5bps'}  new window every ${step} days`);
  for (const h of horizons) {
    const ranked = rows
      .flatMap((r) => r.stats.filter((s) => s.horizonDays === h).map((w) => ({ strategy: r.strategy, interval: r.interval, w })))
      .sort((a, b) => b.w.median - a.w.median);
    const base = rows
      .find((r) => r.interval === '1d' && r.assets === universe.length)
      ?.stats.find((s) => s.horizonDays === h);
    console.log(`\n=== ${h}-day windows, ranked by median return ===`);
    if (base)
      console.log(
        `EW buy and hold, same daily windows: median ${pct(base.hold.median)}, ${Math.round(base.hold.up * 100)}% up, ` +
          `worst ${pct(base.hold.worst)}, latest ${pct(base.lastHold)}`,
      );
    console.log(windowTable(ranked));
  }
  const dir = join(DEFAULT_CACHE_DIR, 'results');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `windows-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify({ source: source(flags), universe, step, horizons, rows }, null, 2));
  console.log(`\nWrote ${file}`);
}

async function cmdCombine(flags: Flags): Promise<void> {
  const universe = list(flags, 'assets') ?? UNIVERSE;
  const only = str(flags, 'only')?.split(',');
  const exclude = new Set(str(flags, 'exclude')?.split(',') ?? []);
  const split = str(flags, 'split') ?? '2024-07-01';
  const maxSize = Number(str(flags, 'max-size') ?? 4);
  const objective = (str(flags, 'objective') ?? 'calmar') as Objective;
  if (objective !== 'calmar' && objective !== 'sortino') throw new Error('--objective must be calmar or sortino');
  const runFlags: Flags = { ...flags };
  delete runFlags.interval;

  const navs: { id: string; byDate: Map<string, number> }[] = [];
  const notes: FetchNote[] = [];
  for (const e of REGISTRY.values()) {
    if ((only && !only.includes(e.id)) || exclude.has(e.id)) continue;
    if (skipReason(e, universe) || (e.config.granularity ?? '1d') !== '1d') continue;
    process.stderr.write(`running ${e.id}... `);
    try {
      const assets = assetsFor(e, universe);
      const { result, closes } = await runFull(e, assets, runFlags, notes);
      navs.push({ id: e.id, byDate: new Map(result.dates.map((d, i) => [d, result.nav[i]!])) });
      if (!navs.some((n) => n.id === 'buy-and-hold') && assets.length === universe.length) {
        const hold = holdFn(assets, closes);
        let v = 1;
        const byDate = new Map<string, number>([[result.dates[0]!, 1]]);
        for (let t = 1; t < result.dates.length; t++) {
          v *= 1 + hold(result.dates[t - 1]!, result.dates[t]!);
          byDate.set(result.dates[t]!, v);
        }
        navs.push({ id: 'buy-and-hold', byDate });
      }
      process.stderr.write('ok\n');
    } catch (err) {
      process.stderr.write(`failed: ${(err as Error).message}\n`);
    }
  }

  navs.push({ id: 'cash', byDate: new Map([...navs[0]!.byDate.keys()].map((d) => [d, 1])) });

  const dates = [...navs[0]!.byDate.keys()].filter((d) => navs.every((n) => n.byDate.has(d))).sort();
  const ids: string[] = [];
  const rets: Float64Array[] = [];
  const dropped: string[] = [];
  for (const n of navs) {
    const r = new Float64Array(dates.length);
    for (let t = 1; t < dates.length; t++) r[t] = n.byDate.get(dates[t]!)! / n.byDate.get(dates[t - 1]!)! - 1;
    if (n.id !== 'cash' && r.every((x) => Math.abs(x) < 1e-12)) {
      dropped.push(`${n.id} (never invested)`);
      continue;
    }
    const twin = rets.findIndex((o) => o.every((x, t) => Math.abs(x - r[t]!) < 1e-12));
    if (twin >= 0 && n.id !== 'cash') {
      dropped.push(`${n.id} (same returns as ${ids[twin]})`);
      continue;
    }
    ids.push(n.id);
    rets.push(r);
  }
  const s = dates.findIndex((d) => d >= split);
  if (s < 92 || dates.length - s < 92) throw new Error(`--split ${split} leaves less than 3 months on one side`);
  const last = dates.length - 1;
  const rebal = monthStarts(dates);
  const trainYears = yearsBetween(dates[0]!, dates[s - 1]!);
  const testYears = yearsBetween(dates[s - 1]!, dates[last]!);

  const t0 = Date.now();
  const scored: ComboScore[] = [];
  for (const c of combinations(ids.length, maxSize)) scored.push(scoreCombo(rets, c, rebal, 0, s - 1, trainYears));
  process.stderr.write(`scored ${scored.length} combos in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  const key = (x: ComboScore): number => (Number.isFinite(x[objective]) ? x[objective] : -Infinity);
  scored.sort((a, b) => key(b) - key(a));

  const name = (idx: number[]): string => idx.map((i) => ids[i]).join(' + ');
  const evaluate = (train: ComboScore) => {
    const test = scoreCombo(rets, train.idx, rebal, s - 1, last, testYears);
    const nav = blendNav(rets, train.idx, rebal, s - 1, last);
    const q = windowStats(dates.slice(s - 1), [...nav], () => 0, 91);
    return { combo: name(train.idx), train, test, testWorstQ: q?.worst ?? NaN, testMedianQ: q?.median ?? NaN };
  };
  const top = scored.slice(0, Number(str(flags, 'top') ?? 15)).map(evaluate);
  const frontier = paretoFrontier(scored).map(evaluate);
  const singles = scored.filter((x) => x.idx.length === 1);
  const holdIdx = ids.indexOf('buy-and-hold');
  const baselines = [
    ...(holdIdx >= 0 ? [evaluate(singles.find((x) => x.idx[0] === holdIdx)!)] : []),
    evaluate(singles[0]!),
  ];

  const head = ['#', 'combo', 'train CAGR', 'train maxDD', `train ${objective}`, 'test CAGR', 'test maxDD', `test ${objective}`, 'test worst 3mo', 'test median 3mo'];
  const tbl = (rows: ReturnType<typeof evaluate>[]): string => {
    const body = rows.map((r, i) => [
      String(i + 1),
      r.combo,
      pct(r.train.cagr),
      pct(r.train.maxDrawdown),
      num(r.train[objective]),
      pct(r.test.cagr),
      pct(r.test.maxDrawdown),
      num(r.test[objective]),
      pct(r.testWorstQ),
      pct(r.testMedianQ),
    ]);
    const widths = head.map((h, c) => Math.max(h.length, ...body.map((r) => r[c]!.length)));
    const line = (cells: string[]): string =>
      cells.map((v, c) => (c === 1 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
    return [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n');
  };

  console.log(
    `\nSource: ${source(flags)}  costs: ${flags['template-costs'] ? 'template' : '10bps + 5bps'}  ` +
      `${ids.length} candidates, combos of 1-${maxSize}, equal-weight sleeves rebalanced monthly`,
  );
  console.log(`Train ${dates[0]} -> ${dates[s - 1]} (picks made here)   Test ${dates[s - 1]} -> ${dates[last]} (unseen)`);
  if (dropped.length) console.log(`Dropped: ${dropped.join('; ')}`);
  console.log('\n=== Baselines: buy and hold, and the best single strategy in training ===');
  console.log(tbl(baselines));
  console.log(`\n=== Top ${top.length} blends by training ${objective} ===`);
  console.log(tbl(top));
  console.log('\n=== Training frontier: no other blend had both higher CAGR and a shallower drawdown ===');
  console.log(tbl(frontier));

  const dir = join(DEFAULT_CACHE_DIR, 'results');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `combine-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify({ source: source(flags), universe, split, maxSize, objective, ids, dropped, baselines, top, frontier }, null, 2));
  console.log(`\nWrote ${file}`);
}

async function cmdCheck(flags: Flags): Promise<void> {
  const assets = list(flags, 'assets') ?? UNIVERSE;
  const start = str(flags, 'start') ?? daysAgo(364);
  const end = str(flags, 'end') ?? today();
  for (const asset of assets) {
    const series = new Map<Source, Map<string, number>>();
    for (const src of SOURCES) {
      try {
        const bars = await createFetchBars({ source: src })({ asset, start, end, interval: '1d' });
        series.set(src, new Map(bars.map((b) => [b.timestamp, b.close])));
      } catch (err) {
        console.log(`${asset} ${src}: ${(err as Error).message}`);
      }
    }
    const [ref, ...others] = [...series.keys()];
    if (!ref) continue;
    for (const o of others) {
      const a = series.get(ref)!;
      const b = series.get(o)!;
      const diffs: { date: string; bps: number }[] = [];
      for (const [date, pa] of a) {
        const pb = b.get(date);
        if (pb) diffs.push({ date, bps: (pb / pa - 1) * 10_000 });
      }
      if (!diffs.length) {
        console.log(`${asset} ${ref} vs ${o}: no shared dates`);
        continue;
      }
      const abs = diffs.map((d) => Math.abs(d.bps)).sort((x, y) => x - y);
      const worst = diffs.reduce((w, d) => (Math.abs(d.bps) > Math.abs(w.bps) ? d : w));
      console.log(
        `${asset} ${ref} vs ${o}: ${diffs.length} days, median |diff| ${abs[abs.length >> 1]!.toFixed(1)} bps, ` +
          `p95 ${abs[Math.floor(abs.length * 0.95)]!.toFixed(1)} bps, worst ${worst.bps.toFixed(1)} bps on ${worst.date}`,
      );
    }
  }
}

function cmdList(): void {
  for (const e of REGISTRY.values()) {
    const reason = skipReason(e, UNIVERSE);
    console.log(`${e.id.padEnd(32)} ${e.mode.padEnd(8)} ${(e.config.granularity ?? '1d').padEnd(4)} ${reason ? `(skip: ${reason})` : ''}`);
  }
}

async function main(): Promise<void> {
  const { cmd, pos, flags } = parseArgs(process.argv.slice(2));
  if (cmd === 'run') return cmdRun(pos, flags);
  if (cmd === 'all') return cmdAll(flags);
  if (cmd === 'check') return cmdCheck(flags);
  if (cmd === 'windows') return cmdWindows(flags);
  if (cmd === 'combine') return cmdCombine(flags);
  if (cmd === 'list') return cmdList();
  console.log('usage: bun src/trading/backtest.ts <list|run|all|check> [flags]; see the header of this file');
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
