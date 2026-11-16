import { cached, getJsonText, mapPool, rateLimiter } from './cache';
import { eventDate, type KalshiMarket, strikeRange } from './markets';
import type { Bucket, MarketEvent, Quote } from './types';

export { eventDate, type KalshiMarket, strikeRange } from './markets';

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const limit = rateLimiter(125);
const get = async <T>(path: string): Promise<T> => {
  await limit();
  return getJsonText<T>(`${BASE}${path}`);
};

interface MarketsPage {
  markets: KalshiMarket[];
  cursor?: string;
}

async function pages(path: string): Promise<KalshiMarket[]> {
  const out: KalshiMarket[] = [];
  let cursor = '';
  for (;;) {
    const page = await get<MarketsPage>(`${path}&limit=1000${cursor ? `&cursor=${cursor}` : ''}`);
    out.push(...page.markets);
    if (!page.cursor || page.markets.length === 0) return out;
    cursor = page.cursor;
  }
}

async function cutoffMs(): Promise<number> {
  const c = await get<{ market_settled_ts: string }>('/historical/cutoff');
  return Date.parse(c.market_settled_ts);
}

export async function settledMarkets(series: string): Promise<{ markets: KalshiMarket[]; cutoff: number }> {
  const cutoff = await cutoffMs();
  const day = new Date(cutoff).toISOString().slice(0, 10);
  const hist = await cached(`kalshi/markets/${series}-historical-${day}`, () =>
    pages(`/historical/markets?series_ticker=${series}`),
  );
  const live = await pages(`/markets?series_ticker=${series}&status=settled`);
  const seen = new Set(hist.map((m) => m.ticker));
  return { markets: [...hist, ...live.filter((m) => !seen.has(m.ticker))], cutoff };
}

interface RawCandle {
  end_period_ts: number;
  yes_bid?: Record<string, string | null>;
  yes_ask?: Record<string, string | null>;
}

const px = (side: Record<string, string | null> | undefined): number | null => {
  const v = side?.close_dollars ?? side?.close;
  return v == null || v === '' ? null : Number(v);
};

export async function candles(series: string, m: KalshiMarket, historical: boolean): Promise<Quote[]> {
  return cached(`kalshi/candles/${series}/${m.ticker}`, async () => {
    const start = Math.floor(Date.parse(m.open_time) / 1000);
    const end = Math.ceil(Date.parse(m.close_time) / 1000);
    const path = historical
      ? `/historical/markets/${m.ticker}/candlesticks`
      : `/series/${series}/markets/${m.ticker}/candlesticks`;
    const res = await get<{ candlesticks: RawCandle[] }>(`${path}?start_ts=${start}&end_ts=${end}&period_interval=60`);
    return res.candlesticks.map((c) => {
      const bid = px(c.yes_bid);
      const ask = px(c.yes_ask);
      return {
        t: c.end_period_ts * 1000,
        bid: bid != null && bid > 0 ? bid : null,
        ask: ask != null && ask < 1 ? ask : null,
      };
    });
  });
}

export interface LoadOptions {
  since: string;
  until: string;
  onProgress?: (done: number, total: number) => void;
}

export async function kalshiEvents(cityId: string, series: string, opts: LoadOptions): Promise<MarketEvent[]> {
  const { markets, cutoff } = await settledMarkets(series);
  const byEvent = new Map<string, KalshiMarket[]>();
  for (const m of markets) {
    const date = eventDate(m.event_ticker);
    if (!date || date < opts.since || date > opts.until) continue;
    if (m.result !== 'yes' && m.result !== 'no') continue;
    const list = byEvent.get(m.event_ticker) ?? [];
    list.push(m);
    byEvent.set(m.event_ticker, list);
  }
  const all = [...byEvent.values()].flat();
  let done = 0;
  const quotes = await mapPool(all, 8, async (m) => {
    const q = await candles(series, m, Date.parse(m.close_time) < cutoff);
    opts.onProgress?.(++done, all.length);
    return [m.ticker, q] as const;
  });
  const quoteMap = new Map(quotes);

  const events: MarketEvent[] = [];
  for (const [eventTicker, ms] of byEvent) {
    const buckets: Bucket[] = [];
    for (const m of ms) {
      const r = strikeRange(m);
      if (!r) continue;
      buckets.push({
        id: m.ticker,
        label: m.yes_sub_title ?? m.ticker,
        lo: r[0],
        hi: r[1],
        result: m.result === 'yes' ? 1 : 0,
        quotes: quoteMap.get(m.ticker) ?? [],
      });
    }
    if (buckets.length < 2 || buckets.filter((b) => b.result === 1).length !== 1) continue;
    buckets.sort((a, b) => a.lo - b.lo);
    const ev = ms.find((m) => m.expiration_value);
    events.push({
      venue: 'kalshi',
      cityId,
      date: eventDate(eventTicker)!,
      closeMs: Math.max(...ms.map((m) => Date.parse(m.close_time))),
      buckets,
      fee: { venue: 'kalshi', rate: 0.07 },
      settledHigh: ev?.expiration_value ? Number(ev.expiration_value) : null,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
