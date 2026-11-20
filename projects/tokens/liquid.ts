import { fmtChange, fmtPct, fmtTokens, priceRow, type Offer } from "./common";

const API = "https://router.inference.ai.exchange/v1/exchange";
const PROVIDERS = ["73449c7f-17dd-4dd7-a03b-3e7ba923ce2d", "2249261a-b9e8-449c-8c79-abf2dc02dd91"];
const HEALTH_DAYS = 3;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export type BookOffer = Record<string, unknown> & {
  offer_id: string;
  provider_id: string;
  provider_slug: string;
  display_name: string | null;
  served_model: string;
  model_deployment: string;
  creator?: string;
  precision?: string;
  region?: string;
  reid_verified: boolean;
  billing_schema: { rate_uncached_input: number | null; rate_generation: number | null };
};

export type Usage = Record<string, unknown> & {
  provider_id: string;
  slug: string;
  served_model: string;
  tokens: number;
  jobs: number;
  median_tokens_per_sec: number | null;
  median_first_event_ms: number | null;
};

export type Deployment = Record<string, unknown> & {
  model_deployment: string;
  precision: string;
  region: string;
  status: string;
  buckets: Array<{ start: string; uptime: number; p50_ms?: number }>;
};

export async function scrapeProvider(id: string) {
  const [info, health] = await Promise.all([
    get<{ provider_id: string; slug: string; display_name: string; admitted_at: string }>(`/providers/${id}`),
    get<{ deployments: Deployment[] }>(`/health/series?provider_id=${id}&days=${HEALTH_DAYS}`),
  ]);
  return { id, slug: info.slug, name: info.display_name, admittedAt: info.admitted_at, deployments: health.deployments };
}

type Scrape = Awaited<ReturnType<typeof scrapeProvider>>;

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function liquidDaily(days: number) {
  const h0 = new Date().getUTCHours();
  const today = Date.parse(isoDay(Date.now()));
  const hours = Array.from({ length: days + 1 }, (_, k) => h0 + 24 * k);
  const windows: Usage[][] = [];
  for (let i = 0; i < hours.length; i += 10)
    windows.push(...(await Promise.all(hours.slice(i, i + 10).map((h) => (h ? get<Usage[]>(`/throughput?hours=${h}`) : [])))));
  const keys = new Map<string, { providerId: string; slug: string; servedModel: string }>();
  for (const u of windows.flat()) keys.set(`${u.provider_id}|${u.served_model}`, { providerId: u.provider_id, slug: u.slug, servedModel: u.served_model });
  return [...keys].map(([key, k]) => {
    const at = (w: number) => windows[w]!.find((u) => `${u.provider_id}|${u.served_model}` === key) ?? { tokens: 0, jobs: 0 };
    const series = Array.from({ length: days }, (_, j) => {
      const [now, prev] = [at(days - j), at(days - j - 1)];
      return { date: isoDay(today - (days - j) * DAY), tokens: Math.max(0, now.tokens - prev.tokens), jobs: Math.max(0, now.jobs - prev.jobs) };
    });
    return { ...k, series };
  });
}

export async function liquidSeries(days: number, ids = PROVIDERS) {
  const [rows, infos] = await Promise.all([
    liquidDaily(days),
    Promise.all(ids.map((id) => get<{ slug: string; display_name: string | null }>(`/providers/${id}`))),
  ]);
  return ids.map((id, i) => {
    const mine = rows.filter((r) => r.providerId === id);
    const series = mine[0]?.series.map((d, j) => ({ date: d.date, tokens: mine.reduce((a, r) => a + r.series[j]!.tokens, 0) })) ?? [];
    return { slug: infos[i]!.slug, name: infos[i]!.display_name ?? infos[i]!.slug, series };
  });
}

export const liquidBook = () => get<BookOffer[]>("/book");
export const LIQUID_TRACKED = PROVIDERS;

const WINDOWS = [1, 2, 7, 14, 30, 60];

export async function usageWindows(): Promise<Map<number, Usage[]>> {
  const rows = await Promise.all(WINDOWS.map((d) => get<Usage[]>(`/throughput?days=${d}`)));
  return new Map(WINDOWS.map((d, i) => [d, rows[i]!]));
}

function tokenTable(results: Scrape[], usage: Map<number, Usage[]>) {
  const total = (id: string, days: number, key: "tokens" | "jobs" = "tokens") =>
    usage.get(days)!.filter((u) => u.provider_id === id).reduce((a, u) => a + u[key], 0);
  return [...results]
    .sort((a, b) => total(b.id, 30) - total(a.id, 30))
    .map((r) => {
      const row: Record<string, string | number> = { Provider: r.slug };
      for (const [label, n] of [["Daily", 1], ["Weekly", 7], ["Monthly", 30]] as const) {
        const now = total(r.id, n);
        row[label] = fmtTokens(now);
        row[`Δ ${n}d`] = fmtChange(now, total(r.id, 2 * n) - now);
      }
      row["Jobs 30d"] = total(r.id, 30, "jobs");
      row.Since = r.admittedAt.slice(0, 10);
      return row;
    });
}

function priceTable(results: Scrape[], book: BookOffer[]) {
  const offers = new Map<string, Offer[]>();
  for (const o of book) {
    const { rate_uncached_input: prompt, rate_generation: completion } = o.billing_schema;
    if (prompt == null || completion == null) continue;
    const list = offers.get(o.served_model) ?? [];
    list.push({ provider: o.provider_slug, providerName: o.display_name ?? o.provider_slug, prompt, completion });
    offers.set(o.served_model, list);
  }
  const tracked = results.map((r) => r.slug);
  return [...offers]
    .filter(([, os]) => os.some((o) => tracked.includes(o.provider)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, os]) => priceRow(model, os, tracked));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : null;
};

function healthTable(results: Scrape[], book: BookOffer[], usage7d: Usage[]) {
  return results.flatMap((r) =>
    r.deployments.map((d) => {
      const offer = book.find((o) => o.model_deployment === d.model_deployment);
      const use = usage7d.find((u) => u.provider_id === r.id && u.served_model === offer?.served_model);
      const up = d.buckets.length ? (d.buckets.reduce((a, b) => a + b.uptime, 0) / d.buckets.length) * 100 : null;
      const p50 = median(d.buckets.flatMap((b) => (b.p50_ms == null ? [] : [b.p50_ms])));
      return {
        Provider: r.slug,
        Model: offer?.served_model ?? d.model_deployment.split("/")[1],
        Region: d.region,
        Precision: d.precision,
        Status: d.status,
        reID: offer?.reid_verified ? "✓" : "",
        [`Up ${HEALTH_DAYS}d`]: fmtPct(up),
        Hours: d.buckets.length,
        "p50 ms": p50 ?? "—",
        "tok/s 7d": use?.median_tokens_per_sec == null ? "—" : Math.round(use.median_tokens_per_sec),
        "TTFT ms 7d": use?.median_first_event_ms == null ? "—" : Math.round(use.median_first_event_ms),
        "Jobs 7d": use?.jobs ?? 0,
      };
    }),
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const ids = args.filter((a) => !a.startsWith("--"));
  const [book, usage] = await Promise.all([get<BookOffer[]>("/book"), usageWindows()]);
  const results: Scrape[] = [];
  for (const id of ids.length ? ids : PROVIDERS) {
    try {
      results.push(await scrapeProvider(id));
    } catch (err) {
      console.error(`${id}: ${(err as Error).message}`);
    }
  }
  if (args.includes("--json")) {
    const mine = (rows: Usage[]) => rows.filter((u) => results.some((r) => r.id === u.provider_id));
    const offers = book.filter((o) => results.some((r) => r.id === o.provider_id));
    console.log(JSON.stringify({ providers: results, offers, usage: Object.fromEntries([...usage].map(([d, rows]) => [`${d}d`, mine(rows)])) }, null, 2));
  } else if (results.length) {
    console.log("\nTokens on the exchange, rolling windows ending now (Δ vs the preceding window of the same length)");
    console.table(tokenTable(results, usage));
    console.log("\nModel pricing, $/M tokens in/out (★ = cheapest on the exchange by 3:1 blended price)");
    console.table(priceTable(results, book));
    console.log(`\nDeployment health (uptime and p50 over observed hours in the last ${HEALTH_DAYS}d; throughput, TTFT and jobs over 7d)`);
    console.table(healthTable(results, book, usage.get(7)!));
  }
}
