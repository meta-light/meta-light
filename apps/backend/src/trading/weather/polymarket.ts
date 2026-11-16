import { cached, getJsonText, mapPool, rateLimiter } from './cache';
import { type GammaEvent, parseList, parseTitle, SERIES_IDS } from './markets';
import type { Bucket, MarketEvent, Quote } from './types';

export { type GammaEvent, type GammaMarket, parseTitle, SERIES_IDS } from './markets';

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const limit = rateLimiter(60);
const get = async <T>(url: string): Promise<T> => {
  await limit();
  return getJsonText<T>(url);
};

async function allEvents(seriesId: number): Promise<GammaEvent[]> {
  const out: GammaEvent[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await get<GammaEvent[]>(
      `${GAMMA}/events?series_id=${seriesId}&closed=true&limit=50&offset=${offset}&order=endDate&ascending=true`,
    );
    out.push(...page);
    if (page.length < 50) return out;
  }
}

export const closedEvents = (seriesId: number): Promise<GammaEvent[]> => allEvents(seriesId);

const parseTime = (s: string): number => Date.parse(s.replace(' ', 'T').replace(/\+00$/, 'Z'));

export async function priceHistory(tokenId: string, fromMs: number, toMs: number): Promise<Quote[]> {
  return cached(`polymarket/prices/${tokenId}`, async () => {
    const res = await get<{ history: { t: number; p: number }[] }>(
      `${CLOB}/prices-history?market=${tokenId}&startTs=${Math.floor(fromMs / 1000)}&endTs=${Math.ceil(toMs / 1000)}&fidelity=60`,
    );
    return res.history.map((h) => ({ t: h.t * 1000, bid: h.p, ask: h.p }));
  });
}

export interface LoadOptions {
  since: string;
  until: string;
  onProgress?: (done: number, total: number) => void;
}

export async function polymarketEvents(cityId: string, series: string, opts: LoadOptions): Promise<MarketEvent[]> {
  const id = SERIES_IDS[series];
  if (id == null) throw new Error(`No Polymarket series id for ${series}`);
  const events = (await closedEvents(id)).filter((e) => {
    const d = e.endDate?.slice(0, 10);
    return d && d >= opts.since && d <= opts.until;
  });

  interface Pending {
    event: GammaEvent;
    rows: { range: [number, number]; title: string; token: string; result: 0 | 1; fee: number }[];
  }
  const pending: Pending[] = [];
  for (const event of events) {
    const rows: Pending['rows'] = [];
    let ok = true;
    for (const m of event.markets) {
      const range = m.groupItemTitle ? parseTitle(m.groupItemTitle) : null;
      const prices = parseList(m.outcomePrices).map(Number);
      const token = parseList(m.clobTokenIds)[0];
      if (!range || !token || prices.length !== 2) {
        ok = false;
        break;
      }
      if (!((prices[0] === 1 && prices[1] === 0) || (prices[0] === 0 && prices[1] === 1))) {
        ok = false;
        break;
      }
      const fee = m.feesEnabled ? (m.feeSchedule?.rate ?? 0) : 0;
      rows.push({ range, title: m.groupItemTitle!, token, result: prices[0] === 1 ? 1 : 0, fee });
    }
    if (ok && rows.length >= 2 && rows.filter((r) => r.result === 1).length === 1) pending.push({ event, rows });
  }

  const tokens = pending.flatMap(({ event, rows }) => {
    const end = Date.parse(event.endDate) + 2 * 86_400_000;
    const from = event.startDate ? Date.parse(event.startDate) : end - 5 * 86_400_000;
    const to = event.closedTime ? Math.min(end, parseTime(event.closedTime)) : end;
    return rows.map((r) => ({ token: r.token, from, to }));
  });
  let done = 0;
  const histories = new Map(
    await mapPool(tokens, 6, async ({ token: t, from, to }) => {
      const h = await priceHistory(t, from, to);
      opts.onProgress?.(++done, tokens.length);
      return [t, h] as const;
    }),
  );

  return pending
    .map(({ event, rows }): MarketEvent => {
      const buckets: Bucket[] = rows
        .map((r) => ({
          id: r.token,
          label: r.title,
          lo: r.range[0],
          hi: r.range[1],
          result: r.result,
          quotes: histories.get(r.token) ?? [],
        }))
        .sort((a, b) => a.lo - b.lo);
      return {
        venue: 'polymarket',
        cityId,
        date: event.endDate.slice(0, 10),
        closeMs: event.closedTime ? parseTime(event.closedTime) : Infinity,
        buckets,
        fee: { venue: 'polymarket', rate: Math.max(...rows.map((r) => r.fee)) },
        settledHigh: null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
