import { getJson, intervalMs, type Row } from './interval';

const BASE = 'https://api.coingecko.com/api/v3';
const DAY = 86_400_000;
const MAX_DAYS = 365;

const IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana' };

export function coingeckoId(asset: string): string {
  const base = asset.toUpperCase().split('-')[0]!;
  const id = IDS[base];
  if (!id) throw new Error(`CoinGecko: no coin id mapped for ${asset}`);
  return id;
}

const memo = new Map<string, Promise<Row[]>>();

export async function fetchCoingecko(
  asset: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Row[]> {
  if (intervalMs(interval) !== DAY) throw new Error('CoinGecko source only serves 1d bars');
  const id = coingeckoId(asset);
  let rows = memo.get(id);
  if (!rows) {
    rows = loadYear(id);
    memo.set(id, rows);
  }
  return (await rows).filter((r) => r[0] >= startMs && r[0] < endMs);
}

interface Chart {
  prices: [number, number][];
  total_volumes: [number, number][];
}

async function loadYear(id: string): Promise<Row[]> {
  const key = process.env.COINGECKO_API_KEY;
  const chart = await getJson<Chart>(
    `${BASE}/coins/${id}/market_chart?vs_currency=usd&days=${MAX_DAYS}&interval=daily`,
    key ? { 'x-cg-demo-api-key': key } : {},
  );
  const volumes = new Map(chart.total_volumes.map(([t, v]) => [t, v]));
  const rows: Row[] = [];
  for (const [t, price] of chart.prices) {
    if (t % DAY !== 0) continue;
    rows.push([t - DAY, price, price, price, price, volumes.get(t) ?? 0]);
  }
  return rows;
}
