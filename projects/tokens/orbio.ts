import { flight, getJson, jsonAfter } from "./index";

type Num = string | number;
export type OrbioDay = Record<string, unknown> & { day: string; models: Array<{ model: string; tokens: Num; requests: Num }> };
export type CreditAsk = { orders: number; discountBps: number; creditsMicroUsd: Num };
type Analytics = {
  asOf: string;
  daily: OrbioDay[];
  totals: Record<string, Num>;
  firstUsageDay: string;
  payments: unknown;
  retail: unknown;
  inferenceSales: unknown;
  protocol: { asOf: string; book: { asks: CreditAsk[]; bids: CreditAsk[] }; totals: Record<string, Num>; orbioSupplyWei: Num } & Record<string, unknown>;
} & Record<string, unknown>;

export async function orbio() {
  const [page, models] = await Promise.all([flight("https://www.orbio.so/analytics"), getJson("https://api.orbio.so/api/v1/models")]);
  const a = jsonAfter<Analytics>(page, '"initial":');
  return { ...a, models: models.data as Array<Record<string, any> & { id: string; name: string }> };
}

if (import.meta.main) {
  const o = await orbio();
  console.log(`${o.models.length} models; ${Number(o.totals.tokens).toLocaleString()} tokens since ${o.firstUsageDay}; ${o.protocol.totals.stakers} stakers`);
  console.table(o.daily.slice(-5).map((d) => ({ day: d.day, tokens: d.models.reduce((s, m) => s + Number(m.tokens), 0), requests: d.requests })));
  console.table(o.protocol.book.asks.map((x) => ({ discount: `${x.discountBps / 100}%`, orders: x.orders, creditsUsd: Math.round(Number(x.creditsMicroUsd) / 1e6) })));
}
