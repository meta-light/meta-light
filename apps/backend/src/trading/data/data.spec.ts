import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { binanceSymbol } from './binance';
import { monthsBetween, withMonthCache } from './cache';
import { aggregate } from './coinbase';
import { coingeckoId } from './coingecko';
import { createFetchBars, fillGaps } from './index';
import { intervalMs, type Row, stamp } from './interval';

const MIN = 60_000;
const DAY = 86_400_000;
const row = (t: number, c: number): Row => [t, c, c + 1, c - 1, c, 10];

describe('intervals', () => {
  it('parses bar sizes and stamps daily vs intraday', () => {
    expect(intervalMs('15m')).toBe(15 * MIN);
    expect(intervalMs('1d')).toBe(DAY);
    expect(() => intervalMs('1wk')).toThrow();
    const t = Date.UTC(2024, 0, 2, 13, 30);
    expect(stamp(t, '1d')).toBe('2024-01-02');
    expect(stamp(t, '30m')).toBe('2024-01-02T13:30:00Z');
  });
});

describe('symbols', () => {
  it('maps to each source', () => {
    expect(binanceSymbol('BTC-USD')).toBe('BTCUSDT');
    expect(binanceSymbol('eth-usdc')).toBe('ETHUSDC');
    expect(coingeckoId('SOL-USD')).toBe('solana');
    expect(() => coingeckoId('HYPE-USD')).toThrow();
  });
});

describe('fillGaps', () => {
  it('carries the prior close across missing bars and drops duplicates', () => {
    const { rows, filled } = fillGaps([row(0, 10), row(3 * MIN, 13), row(0, 99), row(MIN, 11)], MIN);
    expect(rows.map((r) => r[0])).toEqual([0, MIN, 2 * MIN, 3 * MIN]);
    expect(rows[2]).toEqual([2 * MIN, 11, 11, 11, 11, 0]);
    expect(rows[0]![4]).toBe(10);
    expect(filled).toBe(1);
  });
});

describe('aggregate', () => {
  it('builds 30m bars from 15m', () => {
    const step = 30 * MIN;
    const out = aggregate(
      [
        [0, 1, 5, 0.5, 2, 1],
        [15 * MIN, 2, 6, 1, 3, 2],
        [30 * MIN, 3, 4, 2, 4, 3],
      ],
      step,
    );
    expect(out).toEqual([
      [0, 1, 6, 0.5, 3, 3],
      [step, 3, 4, 2, 4, 3],
    ]);
  });
});

describe('month cache', () => {
  it('splits ranges into UTC months', () => {
    const months = monthsBetween(Date.UTC(2024, 0, 15), Date.UTC(2024, 2, 1));
    expect(months).toEqual([Date.UTC(2024, 0, 1), Date.UTC(2024, 1, 1)]);
  });

  it('caches closed months only and filters to the request', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bars-'));
    const now = Date.UTC(2024, 1, 10);
    const fetchRange = vi.fn(async (_a: string, _i: string, s: number, e: number) => {
      const rows: Row[] = [];
      for (let t = s; t < e; t += DAY) rows.push(row(t, t / DAY));
      return rows;
    });
    const cached = withMonthCache('test', fetchRange, dir, () => now);
    const start = Date.UTC(2024, 0, 20);
    const end = Date.UTC(2024, 1, 5);
    const first = await cached('BTC-USD', '1d', start, end);
    expect(first[0]![0]).toBe(start);
    expect(first[first.length - 1]![0]).toBe(end - DAY);
    expect(fetchRange).toHaveBeenCalledTimes(2);
    expect(await readdir(join(dir, 'bars/test/BTC-USD/1d'))).toEqual(['2024-01.json']);
    await cached('BTC-USD', '1d', start, end);
    expect(fetchRange).toHaveBeenCalledTimes(3);
  });
});

describe('createFetchBars', () => {
  it('returns gap-filled DataBars and reports fills', async () => {
    const notes: unknown[] = [];
    const fetchBars = createFetchBars({
      fetchRange: async () => [row(Date.UTC(2024, 0, 1), 1), row(Date.UTC(2024, 0, 3), 3)],
      onFetch: (n) => notes.push(n),
    });
    const bars = await fetchBars({ asset: 'BTC-USD', start: '2024-01-01', end: '2024-01-04', interval: '1d' });
    expect(bars.map((b) => [b.timestamp, b.close])).toEqual([
      ['2024-01-01', 1],
      ['2024-01-02', 1],
      ['2024-01-03', 3],
    ]);
    expect(notes).toEqual([expect.objectContaining({ asset: 'BTC-USD', filled: 1, bars: 3 })]);
  });
});
