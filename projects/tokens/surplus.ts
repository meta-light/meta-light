import { flight, getJson, jsonAfter } from "./index";

const API = "https://api.surplusintelligence.ai";
const SITE = "https://www.surplusintelligence.ai";

export type SurplusMarket = Record<string, any> & {
  model: string;
  best_input_per_1m: number | null;
  best_output_per_1m: number | null;
  direct_input_per_1m: number | null;
  direct_output_per_1m: number | null;
  median_live_discount_pct: number | null;
  num_sellers: number;
  input_tokens_24h: number;
  output_tokens_24h: number;
  requests_24h: number;
};

type Day = { date: string; input_tokens: number; output_tokens: number; requests: number; cache_tokens: number; uncached_input_tokens: number; saved_micro: number };

export async function surplus() {
  const [marketplace, page, resources, keys] = await Promise.all([
    getJson(`${API}/api/marketplace`),
    flight(`${SITE}/analytics`),
    getJson(`${API}/v1/resource/market/analytics`),
    getJson(`${API}/api/markets/keys`),
  ]);
  const { markets, models: _models, ...summary } = marketplace.data as { markets: SurplusMarket[]; models: unknown[] } & Record<string, unknown>;
  const usage = jsonAfter<{ daily: Day[] }>(page, '"usage":');
  const split = jsonAfter<{ series: string[]; daily: Array<{ date: string; tokens: number[] }> }>(page, '"model_split":');
  return { markets, summary, daily: usage.daily, split, resources, keys };
}

if (import.meta.main) {
  const s = await surplus();
  const top = [...s.markets].sort((a, b) => b.input_tokens_24h + b.output_tokens_24h - (a.input_tokens_24h + a.output_tokens_24h)).slice(0, 10);
  console.log(`${s.markets.length} markets, ${s.summary.sellers_live} sellers live, $${Math.round((s.summary.volume_24h as number) / 1e6).toLocaleString()} volume 24h`);
  console.table(top.map((m) => ({ model: m.model, tokens24h: m.input_tokens_24h + m.output_tokens_24h, sellers: m.num_sellers, medianDiscount: m.median_live_discount_pct })));
  console.table(s.daily.slice(-5).map((d) => ({ date: d.date, tokens: d.input_tokens + d.output_tokens, requests: d.requests })));
}
