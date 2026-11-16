import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CACHE_DIR } from '../data/cache';
import { CITIES, cityById, VENUES, type Venue } from './cities';
import { DEFAULT_FILL, type Stats } from './engine';
import { calibration } from './calibration';
import { DEFAULT_MODEL, LEAD_NAMES } from './model';
import { backtest, eventViews, loadCity, validate, type VenueData } from './run';
import { explore, lineup, MIN_EDGES } from './strategies';
import { addDays, isoDate } from './time';

type Flags = Record<string, string>;

function parseArgs(argv: string[]): { cmd: string; flags: Flags } {
  const flags: Flags = {};
  let cmd = 'help';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) flags[a.slice(2)] = argv[++i] ?? '';
    else cmd = a;
  }
  return { cmd, flags };
}

const num = (f: Flags, k: string, d: number): number => (f[k] ? Number(f[k]) : d);

async function load(flags: Flags): Promise<VenueData[]> {
  const venue = flags.venue ?? 'all';
  const venues: Venue[] = venue === 'all' ? [...VENUES] : [venue as Venue];
  if (venues.some((v) => !VENUES.includes(v))) throw new Error(`--venue must be kalshi, polymarket or all`);
  const cities = flags.cities ? flags.cities.split(',').map((c) => cityById(c.trim())) : [...CITIES];
  const since = flags.since ?? '2025-01-01';
  const until = flags.until ?? addDays(isoDate(Date.now()), -2);
  const out: VenueData[] = [];
  for (const v of venues) {
    for (const c of cities) {
      console.error(`loading ${v} ${c.id} ${since}..${until}`);
      out.push(await loadCity(v, c, { since, until, log: (m) => console.error(m) }));
    }
  }
  return out;
}

function table(head: string[], rows: string[][], leftCols = 1): string {
  const widths = head.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c]!.length)));
  const line = (cells: string[]) => cells.map((v, c) => (c < leftCols ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
  return [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const usd = (x: number) => `${x < 0 ? '-' : ''}$${Math.abs(x).toFixed(0)}`;
const statCells = (s: Stats) => [String(s.trades), pct(s.winRate), usd(s.pnl), pct(s.roi), usd(s.maxDrawdown), s.sharpe.toFixed(2)];

async function save(cmd: string, body: unknown): Promise<string> {
  const dir = join(DEFAULT_CACHE_DIR, 'results');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `weather-${cmd}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify(body, null, 2));
  return file;
}

const fillsOf = (flags: Flags) => ({
  stake: num(flags, 'stake', DEFAULT_FILL.stake),
  halfSpread: num(flags, 'half-spread', DEFAULT_FILL.halfSpread),
  maxStaleMs: num(flags, 'max-stale-h', DEFAULT_FILL.maxStaleMs / 3_600_000) * 3_600_000,
});

async function main(): Promise<void> {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  if (cmd === 'sync') {
    const data = await load(flags);
    console.log(table(['venue:city', 'events', 'first', 'last'], data.map((d) => [
      `${d.venue}:${d.city.id}`,
      String(d.events.length),
      d.events[0]?.date ?? '-',
      d.events.at(-1)?.date ?? '-',
    ])));
    return;
  }
  if (cmd === 'validate') {
    const rows = (await load(flags)).map(validate);
    console.log(table(['venue:city', 'events', 'checked', 'agree', 'rate'], rows.map((r) => [
      `${r.venue}:${r.cityId}`,
      String(r.events),
      String(r.checked),
      String(r.agree),
      pct(r.rate),
    ])));
    for (const r of rows.filter((x) => x.mismatches.length)) {
      console.log(`\n${r.venue}:${r.cityId} first mismatches:`);
      for (const m of r.mismatches.slice(0, 8)) console.log(`  ${m.date} ours=${m.actual} paid=${m.won} venueHigh=${m.settledHigh ?? '-'}`);
    }
    console.log(`\nsaved ${await save('validate', rows)}`);
    return;
  }
  if (cmd === 'calibrate') {
    const data = await load(flags);
    const split = flags.split ?? '2026-01-01';
    const fills = fillsOf(flags);
    const out = [];
    for (const venue of VENUES) {
      const views = data.filter((d) => d.venue === venue).flatMap((d) => eventViews(d, DEFAULT_MODEL, fills));
      if (!views.length) continue;
      for (const lead of LEAD_NAMES) {
        for (const [label, keep] of [
          [`train (< ${split})`, (d: string) => d < split],
          [`test (>= ${split})`, (d: string) => d >= split],
        ] as const) {
          const rows = calibration(views, lead, (v) => keep(v.event.date));
          if (!rows.length) continue;
          out.push({ period: label, rows });
          console.log(`\n== ${venue} ${lead} ${label} ==`);
          const roi = (x: number | null) => (x == null ? '-' : pct(x));
          console.log(table(['mid bin', 'n', 'mean mid', 'won', 'YES ROI', 'NO ROI'], rows.map((r) => [
            r.bin, String(r.n), r.mid.toFixed(3), r.freq.toFixed(3), roi(r.yesRoi), roi(r.noRoi),
          ])));
        }
      }
    }
    console.log(`\nsaved ${await save('calibrate', out)}`);
    return;
  }
  if (cmd === 'backtest') {
    const data = await load(flags);
    const split = flags.split ?? '2026-01-01';
    const fills = fillsOf(flags);
    const edges = flags['min-edge'] ? flags['min-edge'].split(',').map(Number) : [...MIN_EDGES];
    const strategies = flags.lineup === 'explore' ? explore() : lineup(edges);
    const res = backtest(data, strategies, DEFAULT_MODEL, fills, split);

    const head = ['strategy', 'trades', 'win', 'P&L', 'ROI', 'maxDD', 'Sharpe'];
    for (const [label, key] of [['all', 'all'], [`train (< ${split})`, 'train'], [`test (>= ${split})`, 'test']] as const) {
      console.log(`\n== ${label} ==`);
      console.log(table(head, strategies.map((s) => [s.name, ...statCells(res.summary[s.name]![key])])));
    }
    console.log('\n== Brier (lower is better; model vs market mids at the same time) ==');
    console.log(table(['venue:city', 'lead', 'events', 'model', 'market'], res.brier.map((b) => [
      `${b.venue}:${b.cityId}`, b.lead, String(b.events), b.model.toFixed(4), b.market.toFixed(4),
    ]), 2));
    const file = await save('backtest', { args: { ...flags, split, fills, model: DEFAULT_MODEL }, ...res });
    console.log(`\nsaved ${file}`);
    return;
  }
  console.log('usage: bun src/trading/weather/cli.ts sync|validate|calibrate|backtest [--venue kalshi|polymarket|all] [--cities nyc,chi,mia,aus,lax] [--since YYYY-MM-DD]');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
