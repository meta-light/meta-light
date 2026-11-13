import type { DataBar } from '../strategies/engine/index';
import { REGISTRY, type StrategyEntry } from './registry';
import { type BarRequest, runStrategy } from './run';

const START = '2022-01-01';
const DAYS = 600;

function syntheticBars(seed: number, days = DAYS): DataBar[] {
  let s = seed;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bars: DataBar[] = [];
  const day0 = Date.parse(`${START}T00:00:00Z`);
  let close = 50 + seed * 10;
  for (let i = 0; i < days; i++) {
    const open = close;
    const drift = Math.sin(i / 60) * 0.004; // alternating trends
    close = open * (1 + drift + (rand() - 0.5) * 0.06);
    bars.push({
      timestamp: new Date(day0 + i * 86_400_000).toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) * (1 + rand() * 0.02),
      low: Math.min(open, close) * (1 - rand() * 0.02),
      close,
      volume: 1_000_000 * (0.5 + rand()),
    });
  }
  return bars;
}

const GENERIC = [
  'BTC-USD',
  'ETH-USD',
  'AAPL',
  'SOL-USD',
  'MSFT',
  'XAU',
  'NVDA',
];

/** Template universe where tickers or contract specs matter, else generic names. */
function assetsFor(entry: StrategyEntry): string[] {
  if (entry.fixedUniverse || entry.assetClass) return entry.config.instruments;
  return GENERIC.slice(0, entry.minAssets);
}

function barsFor(assets: string[]): Record<string, DataBar[]> {
  return Object.fromEntries(assets.map((a, i) => [a, syntheticBars(i + 1)]));
}

describe('registry', () => {
  it('lists every weights and orders template once', () => {
    const ids = [...REGISTRY.keys()];
    expect(ids).toHaveLength(57);
    expect(
      ids.filter((id) => REGISTRY.get(id)!.mode === 'weights'),
    ).toHaveLength(37);
    for (const id of [
      'sma-crossover',
      'signal-confluence',
      'liquidity-based',
      'sma-daily',
      'market-sma-cross',
    ])
      expect(REGISTRY.has(id), id).toBe(true);
  });

  it('builds strategies of the declared mode', () => {
    for (const entry of REGISTRY.values()) {
      const s = entry.create(entry.config);
      expect(s.constructor.name.length, entry.id).toBeGreaterThan(0);
      expect('computeOrders' in s, entry.id).toBe(entry.mode === 'orders');
    }
  });
});

describe('runStrategy on synthetic bars', () => {
  it.each([...REGISTRY.keys()])('%s runs end to end', async (id) => {
    const entry = REGISTRY.get(id)!;
    const assets = assetsFor(entry);
    const { config, result } = await runStrategy({
      strategy: id,
      assets,
      start: START,
      end: '2030-01-01',
      capital: 50_000,
      bars: barsFor(assets),
    });

    expect(config.instruments).toEqual(assets);
    expect(config.initialCapital).toBe(50_000);
    expect(config.benchmarkSymbol).toBe(assets[0]);
    expect(result.dates).toHaveLength(DAYS);
    expect(result.nav).toHaveLength(DAYS);
    expect(result.nav.every(Number.isFinite), 'finite NAV').toBe(true);
    expect(result.nav[0]).toBeCloseTo(50_000, 0);
    expect(result.benchmark).not.toBeNull();
    expect(result.mode.startsWith(entry.mode)).toBe(true);
  });

  it('runs a single-asset template on any ticker', async () => {
    const { result } = await runStrategy({
      strategy: 'sma-crossover',
      assets: ['DOGE-USD'],
      bars: { 'DOGE-USD': syntheticBars(9) },
      start: START,
      end: '2030-01-01',
    });
    expect(result.positions.columns).toEqual(['DOGE-USD']);
    // Weights templates run in weights_fast mode, which records no fills.
    const traded = result.positions.values.some((row) =>
      row.some((v) => v !== 0),
    );
    expect(traded, 'took a position').toBe(true);
  });

  it('trims bars to the period (end exclusive)', async () => {
    const { result } = await runStrategy({
      strategy: 'sma-daily',
      assets: ['AAPL'],
      bars: { AAPL: syntheticBars(1) },
      start: '2022-03-01',
      end: '2022-04-01',
    });
    expect(result.dates[0]).toBe('2022-03-01');
    expect(result.dates.at(-1)).toBe('2022-03-31');
  });

  it('asks fetchBars for each asset with the period and interval', async () => {
    const requests: BarRequest[] = [];
    await runStrategy({
      strategy: 'intraday-1h-sma-trend',
      assets: ['ETH-USD', 'BTC-USD'],
      start: START,
      end: '2023-01-01',
      fetchBars: async (req) => {
        requests.push(req);
        return syntheticBars(requests.length);
      },
    });
    expect(requests).toEqual([
      { asset: 'ETH-USD', start: START, end: '2023-01-01', interval: '1h' },
      { asset: 'BTC-USD', start: START, end: '2023-01-01', interval: '1h' },
    ]);
  });

  it('warns when an FX or futures template gets other symbols', async () => {
    const { result } = await runStrategy({
      strategy: 'fx-time-series-momentum',
      assets: ['EURUSD=X', 'AAPL'],
      bars: barsFor(['EURUSD=X', 'AAPL']),
    });
    expect(result.warnings[0]).toMatch(/fx symbols.*AAPL/);
  });
});

describe('runStrategy rejects bad requests', () => {
  const bars = barsFor(GENERIC);

  it.each([
    [{ strategy: 'nope' }, /Unknown strategy "nope"/],
    [
      { strategy: 'cross-sectional-momentum', assets: GENERIC.slice(0, 5) },
      /needs at least 6 assets, got 5/,
    ],
    [
      { strategy: 'pairs-ratio-zscore', assets: GENERIC.slice(0, 3) },
      /at most 2 assets, got 3/,
    ],
    [
      { strategy: 'signal-change-defensive', assets: ['SPY', 'TLT'] },
      /fixed universe/,
    ],
    [{ strategy: 'sma-crossover', assets: [] }, /no assets given/],
    [
      { strategy: 'sma-crossover', assets: ['AAPL', 'AAPL'] },
      /duplicate assets/,
    ],
    [{ strategy: 'sma-crossover', assets: ['ZZZ'] }, /No bars given for ZZZ/],
    [
      {
        strategy: 'sma-crossover',
        assets: ['AAPL'],
        start: '2030-01-01',
        end: '2031-01-01',
      },
      /No bars for AAPL between/,
    ],
  ])('%o', async (opts, error) => {
    await expect(runStrategy({ bars, ...opts })).rejects.toThrow(error);
  });

  it('needs a data source', async () => {
    await expect(
      runStrategy({ strategy: 'sma-crossover', assets: ['AAPL'] }),
    ).rejects.toThrow(/pass either bars or fetchBars/);
  });
});
