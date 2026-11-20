import { chutesBusiest, chutesPlatform, chutesSummary, chutesTokens } from "./chutes";
import { fmtChange, fmtPct, fmtTokens, priceRow, type Offer } from "./common";
import { openRouterIndex, veniceModels, type VeniceModel } from "./venice";

const BASE = "https://openrouter.ai";
export const PROVIDERS = ["pearl-research", "phala", "io-net", "akashml", "near-ai", "darkbloom", "venice", "chutes", "ambient", "primeintellect", "inference-net"];
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36" };

async function get(path: string): Promise<Response> {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

const memo = new Map<string, Promise<any>>();
export function getJson(path: string): Promise<any> {
  if (!memo.has(path)) memo.set(path, get(path).then((r) => r.json()));
  return memo.get(path)!;
}

export async function flight(path: string): Promise<string> {
  const html = await (await get(path)).text();
  let out = "";
  for (const [, chunk] of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)) {
    const arr = JSON.parse(chunk!);
    if (typeof arr[1] === "string") out += arr[1];
  }
  return out;
}

function jsonAt<T>(text: string, start: number): T {
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if ((c === "}" || c === "]") && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("unbalanced JSON");
}

export function jsonAfter<T>(text: string, anchor: string): T {
  const i = text.indexOf(anchor);
  if (i < 0) throw new Error(`anchor not found: ${anchor}`);
  return jsonAt<T>(text, text.slice(i).search(/[[{]/) + i);
}

type ProviderPage = {
  provider: Record<string, unknown>;
  description?: unknown;
  isHipaaEligible?: boolean;
  models: Array<{ slug: string; name: string; permaslug: string; author?: string; author_display_name?: string; endpoint: Record<string, any> } & Record<string, unknown>>;
  chartData: Array<{ x: string; ys: Record<string, number> }>;
};

async function providerPage(slug: string): Promise<ProviderPage> {
  return jsonAfter<ProviderPage>(await flight(`/provider/${slug}`), `{"providerSlug":"${slug}"`);
}

type Endpoint = {
  provider: string;
  providerName: string;
  tag: string;
  prompt: number;
  completion: number;
  status: number;
  uptime5m: number | null;
  uptime30m: number | null;
  uptime1d: number | null;
  raw: Record<string, unknown>;
};

export async function modelEndpoints(modelSlug: string): Promise<Endpoint[]> {
  const { data } = await getJson(`/api/v1/models/${modelSlug}/endpoints`);
  return data.endpoints.map((e: any) => ({
    provider: e.tag.split("/")[0],
    providerName: e.provider_name,
    tag: e.tag,
    prompt: Number(e.pricing.prompt) * 1e6,
    completion: Number(e.pricing.completion) * 1e6,
    status: e.status,
    uptime5m: e.uptime_last_5m,
    uptime30m: e.uptime_last_30m,
    uptime1d: e.uptime_last_1d,
    raw: e,
  }));
}

export const openRouterCatalog = async (): Promise<Array<Record<string, any> & { id: string; name: string }>> => (await getJson("/api/v1/models")).data;

export async function openRouterWeekly(): Promise<Array<{ week: string; tokens: number }>> {
  const { data } = await getJson("/api/frontend/v1/rankings/model-rankings-chart");
  return (data.data as Array<{ x: string; ys: Record<string, number> }>).map((p) => ({
    week: p.x.slice(0, 10),
    tokens: Object.values(p.ys).reduce((a, v) => a + v, 0),
  }));
}

async function endpointStats(permaslug: string, variant: string, provider: string) {
  const { data } = await getJson(`/api/frontend/v1/stats/endpoint?permaslug=${permaslug}&variant=${variant}`);
  return (data as any[]).filter((e) => e.provider_permaslug === provider).map((e) => ({ tag: e.provider_slug as string, ...e.stats }));
}

const DAY = 86_400_000;
const SERIES_DAYS = 90;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Series = { slug: string; series: Array<{ date: string; tokens: number }> };

function dailySeries(byDate: Map<string, number>): Series["series"] {
  const end = Date.parse(isoDay(Date.now())) - DAY;
  return Array.from({ length: SERIES_DAYS }, (_, i) => {
    const date = isoDay(end - (SERIES_DAYS - 1 - i) * DAY);
    return { date, tokens: byDate.get(date) ?? 0 };
  });
}

const pageSeries = (page: ProviderPage) =>
  dailySeries(new Map((page.chartData ?? []).map((d) => [d.x.slice(0, 10), Object.values(d.ys).reduce((a, b) => a + b, 0)])));

export async function openRouterSeries(slug: string) {
  const page = await providerPage(slug);
  return { slug, name: page.provider.displayName as string, series: pageSeries(page) };
}

export async function scrapeProvider(slug: string) {
  const page = await providerPage(slug);
  const models = await Promise.all(
    page.models.map(async (m) => {
      const [stats, endpoints] = await Promise.all([endpointStats(m.permaslug, m.endpoint.variant, slug), modelEndpoints(m.slug)]);
      return { slug: m.slug, name: m.name, permaslug: m.permaslug, meta: m, stats, endpoints };
    }),
  );
  return {
    slug,
    name: page.provider.displayName as string,
    series: pageSeries(page),
    models,
    page: { provider: page.provider, description: page.description, isHipaaEligible: page.isHipaaEligible, chartData: page.chartData ?? [] },
  };
}

type Scrape = Awaited<ReturnType<typeof scrapeProvider>>;

function windowSum(r: Series, n: number, back = 0): number {
  const end = r.series.length - n * back;
  return r.series.slice(end - n, end).reduce((a, d) => a + d.tokens, 0);
}

function tokenTable(results: Series[]) {
  return [...results]
    .sort((a, b) => windowSum(b, 1) - windowSum(a, 1))
    .map((r) => {
      const row: Record<string, string> = { Provider: r.slug };
      for (const [label, n] of [["Daily", 1], ["Weekly", 7], ["Monthly", 30]] as const) {
        row[label] = fmtTokens(windowSum(r, n));
        row[`Δ ${n}d`] = fmtChange(windowSum(r, n), windowSum(r, n, 1));
      }
      return row;
    });
}

function seriesTable(results: Series[], days: number) {
  const ranked = [...results].sort((a, b) => windowSum(b, days) - windowSum(a, days));
  return ranked[0]!.series.slice(-days).map((d, i, arr) => {
    const row: Record<string, string> = { Date: d.date };
    for (const r of ranked) row[r.slug] = fmtTokens(r.series[r.series.length - arr.length + i]!.tokens);
    return row;
  });
}

function priceTable(results: Scrape[]) {
  const serving = results.filter((r) => r.models.length);
  const models = new Map<string, Endpoint[]>();
  for (const r of serving) for (const m of r.models) models.set(m.slug, m.endpoints);

  const tracked = serving.map((r) => r.slug);
  return [...models]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, endpoints]) => {
      const { Model, ...prices } = priceRow(slug, endpoints, tracked);
      return { ...labModel(slug), ...prices };
    });
}

const labModel = (slug: string) => {
  const i = slug.indexOf("/");
  return { Lab: i < 0 ? "" : slug.slice(0, i), Model: slug.slice(i + 1) };
};

async function veniceTable(models: VeniceModel[]) {
  const toSlug = openRouterIndex((await getJson("/api/v1/models")).data);
  const rows = await Promise.all(
    models.map(async (v) => {
      const slug = toSlug(v);
      const endpoints: Offer[] = slug ? await modelEndpoints(slug).catch(() => []) : [];
      const direct: Offer = { provider: "venice.ai", providerName: "Venice (direct)", prompt: v.prompt, completion: v.completion };
      const { Model, ...prices } = priceRow(v.id, [direct, ...endpoints], ["venice.ai", "venice"]);
      const or = slug ? labModel(slug) : { Lab: "", Model: "" };
      return {
        Lab: or.Lab,
        Model,
        "OpenRouter model": or.Model,
        ...prices,
        Cache: v.cacheRead == null ? "—" : `$${+v.cacheRead.toFixed(3)}`,
        Context: fmtTokens(v.context),
        Privacy: v.privacy,
      };
    }),
  );
  return rows.sort((a, b) => String(a.Model).localeCompare(String(b.Model)));
}

function healthTable(results: Scrape[]) {
  return results.flatMap((r) =>
    r.models.flatMap((m) =>
      m.stats.map((s: any) => {
        const ep = m.endpoints.find((e) => e.tag === s.tag);
        return {
          Provider: r.slug,
          ...labModel(m.slug),
          Tag: s.tag.split("/")[1] ?? "",
          Status: ep?.status ?? "—",
          "Up 5m": fmtPct(ep?.uptime5m),
          "Up 30m": fmtPct(ep?.uptime30m),
          "Up 1d": fmtPct(ep?.uptime1d),
          "p50 ms": s.p50_latency == null ? "—" : Math.round(s.p50_latency),
          "p50 tok/s": s.p50_throughput ?? "—",
          "Req 30m": s.request_count ?? 0,
        };
      }),
    ),
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const slugs = args.filter((a) => !a.startsWith("--"));
  const targets = slugs.length ? slugs : PROVIDERS;
  const optional = <T>(name: string, p: Promise<T>) =>
    p.catch((err) => (console.error(`${name}: ${(err as Error).message}`), undefined));
  const [chutes, venice] = await Promise.all([
    targets.includes("chutes") ? optional("chutes.ai", chutesPlatform()) : undefined,
    targets.includes("venice") ? optional("venice.ai", veniceModels()) : undefined,
  ]);
  const results: Scrape[] = [];
  for (const slug of targets) {
    try {
      results.push(await scrapeProvider(slug));
    } catch (err) {
      console.error(`${slug}: ${(err as Error).message}`);
    }
  }
  const series: Series[] = [...results];
  if (chutes) series.push({ slug: "chutes.ai (all traffic)", series: dailySeries(chutesTokens(chutes)) });

  if (args.includes("--json")) {
    console.log(JSON.stringify({ openrouter: results, chutes, venice }, null, 2));
  } else if (results.length) {
    const through = results[0]!.series.at(-1)!.date;
    console.log(`\nTokens through ${through} (complete UTC days; Δ vs the preceding window of the same length)`);
    console.table(tokenTable(series));
    console.log("\nDaily tokens, last 14 days");
    console.table(seriesTable(series, 14));
    console.log("\nModel pricing, $/M tokens in/out (★ = cheapest on OpenRouter by 3:1 blended price)");
    console.table(priceTable(results));
    console.log("\nEndpoint health (uptime from public API; latency, throughput and requests over the last 30m)");
    console.table(healthTable(results));
  }
  if (!args.includes("--json") && chutes) {
    console.log("\nchutes.ai platform, all traffic (live)");
    console.table(chutesSummary(chutes));
    console.log("\nchutes.ai busiest chutes, last hour");
    console.table(chutesBusiest(chutes, 15));
  }
  if (!args.includes("--json") && venice) {
    console.log("\nVenice direct pricing vs OpenRouter, $/M tokens in/out (venice.ai = direct API, venice = Venice on OpenRouter; ★ = cheapest overall)");
    console.table(await veniceTable(venice));
  }
}
