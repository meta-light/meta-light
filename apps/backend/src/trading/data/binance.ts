import { getJson, intervalMs, type Row, sleep } from './interval';

const BASE = 'https://data-api.binance.vision/api/v3/klines';
const LIMIT = 1000;
const WEIGHT_PAUSE = 5000;

export function binanceSymbol(asset: string): string {
  const [base, quote] = asset.toUpperCase().split('-');
  if (!base || !quote) throw new Error(`Binance: expected BASE-QUOTE, got ${asset}`);
  return `${base}${quote === 'USD' ? 'USDT' : quote}`;
}

type Kline = [number, string, string, string, string, string, number, ...unknown[]];

export async function fetchBinance(
  asset: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Row[]> {
  const step = intervalMs(interval);
  const symbol = binanceSymbol(asset);
  const now = Date.now();
  const out: Row[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const url = `${BASE}?symbol=${symbol}&interval=${interval}&startTime=${cursor}&endTime=${endMs - 1}&limit=${LIMIT}`;
    const rows = await getJson<Kline[]>(url, {}, async (res) => {
      const used = Number(res.headers.get('x-mbx-used-weight-1m'));
      if (used > WEIGHT_PAUSE) await sleep(60_000 - (Date.now() % 60_000) + 1000);
    });
    for (const k of rows) {
      if (k[6] >= now) continue;
      out.push([k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    }
    if (rows.length < LIMIT) break;
    cursor = rows[rows.length - 1]![0] + step;
  }
  return out;
}
