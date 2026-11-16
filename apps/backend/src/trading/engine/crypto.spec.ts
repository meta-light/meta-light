import { describe, expect, it } from 'vitest';
import { getContractSpec } from '../strategies/engine/execution/contract-spec';
import type { DataBar } from '../strategies/engine/index';
import { periodsPerYear, runStrategy } from './run';

const DAY = 86_400_000;

function bars(start: string, n: number, price: number): DataBar[] {
  const t0 = Date.parse(start);
  return Array.from({ length: n }, (_, i) => {
    const c = price * (1 + 0.002 * i + 0.03 * Math.sin(i / 5));
    return {
      timestamp: new Date(t0 + i * DAY).toISOString().slice(0, 10),
      open: c,
      high: c * 1.01,
      low: c * 0.99,
      close: c,
      volume: 1000,
    };
  });
}

describe('crypto contract specs', () => {
  it('treats XXX-USD style pairs as fractional crypto', () => {
    for (const s of ['BTC-USD', 'SOL-USD', 'ETH-USDT', 'ARB-USDC']) {
      const spec = getContractSpec(s);
      expect(spec.assetClass).toBe('crypto');
      expect(spec.roundQuantity(0.123456)).toBeCloseTo(0.123456);
    }
    expect(getContractSpec('AAPL').assetClass).toBe('equity');
    expect(getContractSpec('AAPL').roundQuantity(2.7)).toBe(2);
  });
});

describe('periodsPerYear', () => {
  it('annualises crypto over 365 x 24h and equities over 252 x 6.5h', () => {
    expect(periodsPerYear('1d', ['BTC-USD'])).toBe(365);
    expect(periodsPerYear('1h', ['BTC-USD', 'ETH-USD'])).toBe(365 * 24);
    expect(periodsPerYear('1m', ['SOL-USD'])).toBe(365 * 1440);
    expect(periodsPerYear('1d', ['AAPL'])).toBe(252);
    expect(periodsPerYear('1h', ['AAPL'])).toBe(Math.round(252 * 6.5));
    expect(periodsPerYear('1d', ['BTC-USD', 'AAPL'])).toBe(252);
    expect(periodsPerYear('1wk', ['BTC-USD'])).toBe(52);
  });
});

describe('runStrategy on crypto', () => {
  it('orders templates buy fractional BTC', async () => {
    const { result } = await runStrategy({
      strategy: 'market-sma-cross',
      assets: ['BTC-USD'],
      start: '2023-01-01',
      end: '2024-01-01',
      bars: { 'BTC-USD': bars('2023-01-01', 365, 60_000) },
      capital: 10_000,
    });
    expect(result.fills.length).toBeGreaterThan(0);
    expect(result.fills.some((f) => !Number.isInteger(f.quantity))).toBe(true);
  });

  it('trims to the latest listing date and warns', async () => {
    const { result } = await runStrategy({
      strategy: 'sma-crossover',
      assets: ['BTC-USD', 'SOL-USD'],
      start: '2023-01-01',
      end: '2024-01-01',
      bars: {
        'BTC-USD': bars('2023-01-01', 365, 60_000),
        'SOL-USD': bars('2023-03-01', 306, 20),
      },
    });
    expect(result.dates[0]).toBe('2023-03-01');
    expect(result.warnings.some((w) => w.includes('Trimmed start to 2023-03-01'))).toBe(true);
  });

  it('applies a costs override', async () => {
    const run = (bps: number) =>
      runStrategy({
        strategy: 'market-sma-cross',
        assets: ['BTC-USD'],
        start: '2023-01-01',
        end: '2024-01-01',
        bars: { 'BTC-USD': bars('2023-01-01', 365, 60_000) },
        costs: { commission: { type: 'fixed_bps', bps }, slippage: { type: 'fixed_bps', bps: 0 } },
      });
    const [cheap, dear] = await Promise.all([run(0), run(100)]);
    expect(dear.config.commission).toEqual({ type: 'fixed_bps', bps: 100 });
    expect(dear.result.nav.at(-1)!).toBeLessThan(cheap.result.nav.at(-1)!);
  });
});
