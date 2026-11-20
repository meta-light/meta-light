import { fmtChange, fmtTokens } from "./common";

const API = "https://antseedstats.com/api/v1";
const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return ((await res.json()) as { data: T }).data;
}

export type Day = {
  day: string;
  settled_micro: number;
  fees_micro: number;
  tokens_in: number;
  tokens_out: number;
  free_tokens: number;
  requests: number;
  free_requests: number;
  buyers: number;
  sellers: number;
  new_users: number;
};

type Seller = {
  name: string | null;
  address: string;
  live: boolean;
  verified: boolean;
  organic: boolean;
  reputation: number;
  models: number;
  revenue_24h_micro: number;
  revenue_prev_24h_micro: number;
  revenue_7d_micro: number;
  revenue_30d_micro: number;
  revenue_prev_30d_micro: number;
  tokens_30d: number;
};

type ModelUsage = Record<string, unknown> & { settled_micro: number; tokens: number; buyers: number; requests?: number; sellers?: number };

export type AntseedModel = Record<string, unknown> & {
  model: string;
  display: string;
  sellers: number;
  min_input_usd_per_m: number | null;
  min_output_usd_per_m: number | null;
  max_input_usd_per_m?: number | null;
  max_output_usd_per_m?: number | null;
  usage?: ModelUsage;
  usage_all?: ModelUsage;
  usage_period: ModelUsage;
};
type Model = AntseedModel;

type Health = {
  services: number;
  healthy: number;
  failing: number;
  sellers_reporting: number;
  sellers_failing: number;
  requests_last_hour: number;
  by_seller: Array<{ name: string | null; address: string; proven: boolean; reputation: number; services: number; healthy: number; failing: number; top_reason_label: string | null; requests_last_hour: number }>;
};

export async function scrape() {
  const today = Date.parse(isoDay(Date.now()));
  const [daily, sellers, models, health] = await Promise.all([
    get<{ days: Day[] }>(`/network/daily?from=${isoDay(today - 60 * DAY)}&to=${isoDay(today - DAY)}`),
    get<{ sellers: Seller[] }>("/sellers?sort=revenue_30d&limit=15"),
    get<{ models: Model[] }>("/models?period=30d&sort=tokens&limit=20"),
    get<Health>("/network/health"),
  ]);
  return { daily: daily.days, sellers: sellers.sellers, models: models.models, health };
}

const usd = (micro: number) => `$${Math.round(micro / 1e6).toLocaleString()}`;
const sellerName = (s: { name: string | null; address: string }) => s.name ?? `${s.address.slice(0, 8)}…`;

const METRICS: Array<[string, (d: Day) => number, (n: number) => string]> = [
  ["Paid tokens", (d) => d.tokens_in + d.tokens_out, fmtTokens],
  ["Free tokens", (d) => d.free_tokens, fmtTokens],
  ["Settled", (d) => d.settled_micro, usd],
  ["Fees", (d) => d.fees_micro, usd],
  ["Paid requests", (d) => d.requests, (n) => n.toLocaleString()],
  ["Free requests", (d) => d.free_requests, (n) => n.toLocaleString()],
];

function windowTable(days: Day[]) {
  const sum = (f: (d: Day) => number, n: number, back = 0) =>
    days.slice(days.length - n * (back + 1), days.length - n * back).reduce((a, d) => a + f(d), 0);
  return METRICS.map(([metric, f, fmt]) => {
    const row: Record<string, string> = { Metric: metric };
    for (const [label, n] of [["Daily", 1], ["Weekly", 7], ["Monthly", 30]] as const) {
      row[label] = fmt(sum(f, n));
      row[`Δ ${n}d`] = fmtChange(sum(f, n), sum(f, n, 1));
    }
    return row;
  });
}

function seriesTable(days: Day[], n: number) {
  return days.slice(-n).map((d) => ({
    Date: d.day,
    "Paid tokens": fmtTokens(d.tokens_in + d.tokens_out),
    "Free tokens": fmtTokens(d.free_tokens),
    Settled: usd(d.settled_micro),
    Requests: d.requests,
    Buyers: d.buyers,
    Sellers: d.sellers,
    "New users": d.new_users,
  }));
}

function sellerTable(sellers: Seller[]) {
  return sellers.map((s) => ({
    Seller: sellerName(s),
    Live: s.live ? "✓" : "",
    Verified: s.verified ? "✓" : "",
    Organic: s.organic ? "✓" : "wash",
    Rep: Math.round(s.reputation),
    Models: s.models,
    "Rev 24h": usd(s.revenue_24h_micro),
    "Δ 24h": fmtChange(s.revenue_24h_micro, s.revenue_prev_24h_micro),
    "Rev 7d": usd(s.revenue_7d_micro),
    "Rev 30d": usd(s.revenue_30d_micro),
    "Δ 30d": fmtChange(s.revenue_30d_micro, s.revenue_prev_30d_micro),
    "Tokens 30d": fmtTokens(s.tokens_30d),
  }));
}

const price = (p: number | null) => (p == null ? "—" : `$${+p.toFixed(3)}`);

function modelTable(models: Model[]) {
  return models.map((m) => ({
    Model: m.display,
    Sellers: m.sellers,
    "Min in": price(m.min_input_usd_per_m),
    "Min out": price(m.min_output_usd_per_m),
    "Tokens 30d": fmtTokens(m.usage_period.tokens),
    "Settled 30d": usd(m.usage_period.settled_micro),
    "Buyers 30d": m.usage_period.buyers,
  }));
}

function healthTable(h: Health) {
  return [...h.by_seller]
    .sort((a, b) => b.failing - a.failing || b.requests_last_hour - a.requests_last_hour)
    .slice(0, 20)
    .map((s) => ({
      Seller: sellerName(s),
      Proven: s.proven ? "✓" : "",
      Rep: Math.round(s.reputation),
      Services: s.services,
      Healthy: s.healthy,
      Failing: s.failing,
      "Top failure": s.top_reason_label ?? "",
      "Req 1h": s.requests_last_hour,
    }));
}

if (import.meta.main) {
  const data = await scrape();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    const h = data.health;
    console.log(`\nAntSeed network through ${data.daily.at(-1)?.day} (complete UTC days; Δ vs the preceding window of the same length)`);
    console.table(windowTable(data.daily));
    console.log("\nDaily, last 14 days");
    console.table(seriesTable(data.daily, 14));
    console.log("\nTop sellers by 30d revenue (organic = outside the wash registry)");
    console.table(sellerTable(data.sellers));
    console.log("\nTop models by 30d tokens, organic sellers ($/M tokens, cheapest listing)");
    console.table(modelTable(data.models));
    console.log(`\nHealth now: ${h.healthy}/${h.services} services healthy, ${h.failing} failing; ${h.sellers_failing}/${h.sellers_reporting} reporting sellers have failures; ${h.requests_last_hour.toLocaleString()} requests last hour`);
    console.table(healthTable(h));
  }
}
