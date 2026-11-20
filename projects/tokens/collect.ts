import { scrape as antseedScrape } from "./antseed";
import { Catalog, providerId, Providers, splitVariant } from "./catalog";
import { chutesPlatform } from "./chutes";
import { ambientModels, primeIntellectModels } from "./direct";
import { modelEndpoints, openRouterCatalog, openRouterWeekly, PROVIDERS as OR_TRACKED, scrapeProvider as openRouterProvider } from "./index";
import { buildInstruments } from "./instruments";
import { LIQUID_TRACKED, liquidBook, liquidDaily, scrapeProvider as liquidProvider, usageWindows } from "./liquid";
import { ostr } from "./mercatus";
import { orbio } from "./orbio";
import type { Health, Listing, Price, Snapshot, Usage, UsageTotal } from "./schema";
import { surplus } from "./surplus";
import { veniceModels } from "./venice";
import { diem } from "./venicestats";

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined);
const without = <T extends Record<string, unknown>>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

export async function collect(days = 90): Promise<Snapshot> {
  const errors: string[] = [];
  const settle = <T>(name: string, p: Promise<T>) => p.catch((err) => (errors.push(`${name}: ${(err as Error).message}`), undefined));

  const [orCatalog, orPages, lqDaily, lqBook, lqWindows, lqProviders, antseed, chutes, venice, sp, ob, ostrSeries, ambient, prime, diemData, orWeekly] = await Promise.all([
    settle("openrouter catalog", openRouterCatalog()),
    Promise.all(OR_TRACKED.map((slug) => settle(`openrouter ${slug}`, openRouterProvider(slug)))),
    settle("liquid daily", liquidDaily(days)),
    settle("liquid book", liquidBook()),
    settle("liquid windows", usageWindows()),
    Promise.all(LIQUID_TRACKED.map((id) => settle(`liquid ${id}`, liquidProvider(id)))),
    settle("antseed", antseedScrape()),
    settle("chutes direct", chutesPlatform()),
    settle("venice direct", veniceModels()),
    settle("surplus", surplus()),
    settle("orbio", orbio()),
    settle("mercatus ostr", ostr()),
    settle("ambient direct", ambientModels()),
    settle("prime intellect direct", primeIntellectModels()),
    settle("venicestats diem", diem()),
    settle("openrouter weekly", openRouterWeekly()),
  ]);

  const through = isoDay(Date.parse(isoDay(Date.now())) - DAY);
  const catalog = new Catalog(orCatalog ?? []);
  const providers = new Providers();
  const listings: Listing[] = [];
  const usage: Usage[] = [];
  const totals: UsageTotal[] = [];
  const health: Health[] = [];
  const orPageList = orPages.flatMap((p) => (p ? [p] : []));
  for (const p of orPageList) providers.add(p.slug, p.name, true, { channel: "openrouter", externalId: p.slug, extra: p.page });
  for (const p of lqProviders.flatMap((x) => (x ? [x] : [])))
    providers.add(p.slug, p.name ?? p.slug, true, { channel: "liquid", externalId: p.id, extra: { admittedAt: p.admittedAt } });
  if (chutes) providers.add("chutes", "Chutes", true, { channel: "direct", externalId: "https://chutes.ai", extra: { overview: chutes.overview, users: chutes.users } });
  if (venice) providers.add("venice", "Venice", true, { channel: "direct", externalId: "https://api.venice.ai", extra: {} });
  const direct = [
    { id: "ambient", name: "Ambient", api: "https://api.ambient.xyz", models: ambient },
    { id: "primeintellect", name: "Prime Intellect", api: "https://api.pinference.ai", models: prime },
  ];
  for (const d of direct) if (d.models) providers.add(d.id, d.name, true, { channel: "direct", externalId: d.api, extra: {} });
  const liquidTrackedIds = new Set(lqProviders.flatMap((p) => (p ? [p.id] : [])));
  for (const p of orPageList)
    for (const m of p.models) catalog.add({ channel: "openrouter", provider: providerId(p.slug), raw: m.slug, name: m.name });
  for (const o of lqBook ?? [])
    if (liquidTrackedIds.has(o.provider_id))
      catalog.add({ channel: "liquid", provider: providerId(o.provider_slug), raw: o.served_model }, { keys: [o.model_family as string], lab: o.creator });
  for (const v of venice ?? []) catalog.add({ channel: "direct", provider: "venice", raw: v.id, name: v.name }, { keys: [v.source, v.name], name: v.name, context: v.context });
  for (const m of antseed?.models ?? []) catalog.add({ channel: "antseed", raw: m.model, name: m.display }, { keys: [m.display], name: m.display });
  for (const d of direct)
    for (const m of d.models ?? []) catalog.add({ channel: "direct", provider: d.id, raw: m.id, name: m.name }, { keys: m.keys, name: m.name, context: m.context });
  const spTop = [...(sp?.markets ?? [])].sort((a, b) => b.input_tokens_24h + b.output_tokens_24h - (a.input_tokens_24h + a.output_tokens_24h)).slice(0, 10);
  for (const m of spTop) catalog.add({ channel: "surplus", raw: m.model });
  const obTokens = new Map<string, number>();
  for (const d of ob?.daily.slice(-30) ?? []) for (const m of d.models) if (m.model !== "other") obTokens.set(m.model, (obTokens.get(m.model) ?? 0) + Number(m.tokens));
  for (const [raw] of [...obTokens].sort((a, b) => b[1] - a[1]).slice(0, 10))
    catalog.add({ channel: "orbio", raw }, { name: ob?.models.find((m) => m.id === raw)?.name.split(": ").pop() });
  for (const p of orPageList) {
    const byPermaslug = new Map(p.models.map((m) => [m.permaslug, m.slug]));
    const provider = providerId(p.slug);
    for (const point of p.page.chartData) {
      const date = point.x.slice(0, 10);
      if (date > through) continue;
      for (const [key, tokens] of Object.entries(point.ys)) {
        if (!tokens) continue;
        const model = key === "Others" ? undefined : catalog.find("openrouter", byPermaslug.get(key) ?? key);
        usage.push({ channel: "openrouter", provider, model, date, tokens, extra: model ? undefined : { rawModel: key } });
      }
    }
  }
  const seen = new Set<string>();
  const endpointsFor = new Map<string, Awaited<ReturnType<typeof modelEndpoints>>>();
  for (const p of orPageList) for (const m of p.models) endpointsFor.set(m.slug, m.endpoints);
  await Promise.all(
    catalog.matchedIds().filter((id) => !endpointsFor.has(id)).map(async (id) => {
      const eps = await settle(`openrouter endpoints ${id}`, modelEndpoints(id));
      if (eps) endpointsFor.set(id, eps);
    }),
  );
  for (const [slug, eps] of endpointsFor) {
    const model = catalog.find("openrouter", slug) ?? slug;
    for (const e of eps) {
      if (seen.has(`${model}|${e.tag}`)) continue;
      seen.add(`${model}|${e.tag}`);
      const provider = providers.add(e.provider, e.providerName, false, { channel: "openrouter", externalId: e.provider, extra: {} });
      const raw = e.raw as Record<string, any>;
      const cacheRead = raw.pricing?.input_cache_read == null ? undefined : Number(raw.pricing.input_cache_read) * 1e6;
      listings.push({
        channel: "openrouter", provider, model, rawModel: slug, variant: e.tag.split("/")[1],
        price: { prompt: e.prompt, completion: e.completion, cacheRead }, context: raw.context_length, status: String(e.status), extra: raw,
      });
    }
  }
  for (const p of orPageList)
    for (const m of p.models)
      for (const s of m.stats as Array<Record<string, any>>) {
        const ep = m.endpoints.find((e) => e.tag === s.tag);
        health.push({
          channel: "openrouter", provider: providerId(p.slug), model: catalog.find("openrouter", m.slug), variant: s.tag.split("/")[1], window: "30m",
          uptime: ep?.uptime30m ?? undefined, p50LatencyMs: s.p50_latency ?? undefined, p50TokensPerSec: s.p50_throughput ?? undefined, requests: s.request_count ?? undefined,
          extra: { ...without(s, "tag", "p50_latency", "p50_throughput", "request_count"), status: ep?.status, uptime5m: ep?.uptime5m, uptime1d: ep?.uptime1d },
        });
      }
  const lqSlug = new Map((lqBook ?? []).map((o) => [o.provider_id, { slug: o.provider_slug, name: o.display_name ?? o.provider_slug }]));
  const lqProvider = (id: string, slug: string) => {
    const info = lqSlug.get(id) ?? { slug, name: slug };
    return providers.add(info.slug, info.name, false, { channel: "liquid", externalId: id, extra: {} });
  };
  for (const r of lqDaily ?? []) {
    const provider = lqProvider(r.providerId, r.slug);
    const model = catalog.find("liquid", r.servedModel);
    const variant = splitVariant(r.servedModel).variant;
    for (const d of r.series)
      if (d.tokens || d.jobs)
        usage.push({ channel: "liquid", provider, model, date: d.date, tokens: d.tokens, requests: d.jobs, extra: model && !variant ? undefined : { rawModel: r.servedModel } });
  }
  for (const [days, rows] of lqWindows ?? [])
    for (const u of rows) {
      const model = catalog.find("liquid", u.served_model);
      totals.push({
        channel: "liquid", provider: lqProvider(u.provider_id, u.slug), model, days, asOf: new Date().toISOString(), tokens: u.tokens, requests: u.jobs,
        extra: { ...without(u, "provider_id", "slug", "tokens", "jobs"), ...(model ? {} : { rawModel: u.served_model }) },
      });
    }
  for (const o of lqBook ?? []) {
    const model = catalog.find("liquid", o.served_model);
    if (!model) continue;
    const b = o.billing_schema as Record<string, number | null>;
    listings.push({
      channel: "liquid", provider: lqProvider(o.provider_id, o.provider_slug), model, rawModel: o.served_model, variant: o.model_deployment,
      price: b.rate_uncached_input == null || b.rate_generation == null ? undefined : { prompt: b.rate_uncached_input, completion: b.rate_generation, cacheRead: b.rate_cache_read ?? undefined },
      context: (o.input_length_band as { max?: number } | undefined)?.max, status: o.reid_verified ? "reid-verified" : undefined, extra: o,
    });
  }
  const tps7d = new Map((lqWindows?.get(7) ?? []).map((u) => [`${u.provider_id}|${u.served_model}`, u]));
  for (const p of lqProviders.flatMap((x) => (x ? [x] : []))) {
    const provider = providerId(p.slug);
    for (const d of p.deployments) {
      const offer = lqBook?.find((o) => o.model_deployment === d.model_deployment);
      const raw = offer?.served_model ?? d.model_deployment.split("/")[1]!;
      const model = catalog.find("liquid", raw);
      const up = d.buckets.length ? (d.buckets.reduce((a, b) => a + b.uptime, 0) / d.buckets.length) * 100 : undefined;
      health.push({
        channel: "liquid", provider, model, variant: d.model_deployment, window: "3d", uptime: up,
        p50LatencyMs: median(d.buckets.flatMap((b) => (b.p50_ms == null ? [] : [b.p50_ms]))), extra: { ...without(d, "model_deployment"), rawModel: raw },
      });
      const t = tps7d.get(`${p.id}|${raw}`);
      if (t)
        health.push({
          channel: "liquid", provider, model, variant: d.model_deployment, window: "7d", requests: t.jobs,
          p50TokensPerSec: t.median_tokens_per_sec ?? undefined, ttftMs: t.median_first_event_ms ?? undefined, extra: { rawModel: raw },
        });
    }
  }
  for (const d of antseed?.daily ?? [])
    usage.push({ channel: "antseed", date: d.day, tokens: d.tokens_in + d.tokens_out, requests: d.requests, extra: without(d, "day", "requests") });
  for (const m of antseed?.models ?? []) {
    const model = catalog.find("antseed", m.model);
    totals.push({
      channel: "antseed", model, days: 30, asOf: new Date().toISOString(), tokens: m.usage_period.tokens,
      extra: { rawModel: m.model, settledMicro: m.usage_period.settled_micro, buyers: m.usage_period.buyers, usage: m.usage, usageAll: m.usage_all },
    });
    const has = (n: number | null | undefined): n is number => n != null;
    listings.push({
      channel: "antseed", model: model!, rawModel: m.model,
      price: has(m.min_input_usd_per_m) && has(m.min_output_usd_per_m) ? { prompt: m.min_input_usd_per_m, completion: m.min_output_usd_per_m } : undefined,
      priceMax: has(m.max_input_usd_per_m) && has(m.max_output_usd_per_m) ? { prompt: m.max_input_usd_per_m, completion: m.max_output_usd_per_m } : undefined,
      extra: without(m, "model", "min_input_usd_per_m", "min_output_usd_per_m", "max_input_usd_per_m", "max_output_usd_per_m", "usage", "usage_all", "usage_period"),
    });
  }
  for (const d of chutes?.daily ?? [])
    if (d.date <= through) usage.push({ channel: "direct", provider: "chutes", date: d.date, tokens: d.tokens, requests: d.count });
  for (const u of chutes?.utilization ?? []) {
    const model = catalog.find("openrouter", u.name) ?? catalog.find("direct", u.name);
    health.push({
      channel: "direct", provider: "chutes", model, window: "1h", requests: u.total_requests_1h, uptime: undefined,
      extra: { ...without(u, "total_requests_1h"), ...(model ? {} : { rawModel: u.name }) },
    });
  }
  for (const v of venice ?? [])
    listings.push({
      channel: "direct", provider: "venice", model: catalog.find("direct", v.id)!, rawModel: v.id,
      price: { prompt: v.prompt, completion: v.completion, cacheRead: v.cacheRead ?? undefined }, context: v.context, status: v.offline ? "offline" : "online", extra: v.raw,
    });
  for (const d of direct)
    for (const m of d.models ?? [])
      listings.push({ channel: "direct", provider: d.id, model: catalog.find("direct", m.id)!, rawModel: m.id, price: m.price, context: m.context, status: m.status, extra: m.raw });
  if (sp)
    for (const d of sp.split.daily) {
      if (d.date > through) continue;
      d.tokens.forEach((tokens, i) => {
        const raw = sp.split.series[i]!;
        const model = raw === "Other" ? undefined : catalog.find("surplus", raw);
        if (tokens) usage.push({ channel: "surplus", model, date: d.date, tokens, extra: model ? undefined : { rawModel: raw } });
      });
    }
  for (const m of sp?.markets ?? []) {
    const model = catalog.find("surplus", m.model);
    if (!model) continue;
    const perM = (micro: number | null) => (micro == null ? undefined : micro / 1e6);
    const best = { prompt: perM(m.best_input_per_1m), completion: perM(m.best_output_per_1m), cacheRead: perM(m.best_cache_read_per_1m) };
    const list = { prompt: perM(m.direct_input_per_1m), completion: perM(m.direct_output_per_1m) };
    listings.push({
      channel: "surplus", model, rawModel: m.model,
      price: best.prompt == null || best.completion == null ? undefined : (best as Price),
      priceMax: list.prompt == null || list.completion == null ? undefined : (list as Price),
      status: `${m.num_sellers} sellers`, extra: without(m, "discount_trend"),
    });
  }
  for (const d of ob?.daily ?? []) {
    if (d.day > through) continue;
    for (const m of d.models) {
      const model = m.model === "other" ? undefined : catalog.find("orbio", m.model);
      if (Number(m.tokens)) usage.push({ channel: "orbio", model, date: d.day, tokens: Number(m.tokens), requests: Number(m.requests), extra: model ? undefined : { rawModel: m.model } });
    }
  }
  for (const m of ob?.models ?? []) {
    const model = catalog.find("orbio", m.id);
    if (!model || m.pricing?.prompt == null) continue;
    listings.push({
      channel: "orbio", model, rawModel: m.id, context: m.context_length, extra: m,
      price: { prompt: Number(m.pricing.prompt) * 1e6, completion: Number(m.pricing.completion) * 1e6, cacheRead: m.pricing.input_cache_read == null ? undefined : Number(m.pricing.input_cache_read) * 1e6 },
    });
  }
  const weekly = (orWeekly ?? []).filter((w) => Date.parse(w.week) + 7 * DAY <= Date.parse(through) + DAY);
  return {
    generated: new Date().toISOString(),
    through,
    marketplaces: [
      {
        id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai", kind: "router", dayBasis: "Complete UTC days", coverage: "tracked",
        extra: { catalogSize: orCatalog?.length, weekly },
      },
      {
        id: "liquid", name: "Liquid Inference", url: "https://inference.ai.exchange", kind: "exchange", coverage: "all",
        dayBasis: "Differenced from rolling hourly windows, so each day starts up to an hour after UTC midnight", extra: { offers: lqBook?.length },
      },
      {
        id: "antseed", name: "AntSeed", url: "https://antseedstats.com", kind: "p2p", coverage: "all",
        dayBasis: "Complete UTC days; tokens are paid tokens in + out, free tokens are in extra", extra: { sellers: antseed?.sellers, health: antseed?.health },
      },
      {
        id: "surplus", name: "Surplus", url: "https://www.surplusintelligence.ai", kind: "p2p", coverage: "all",
        dayBasis: "Complete UTC days; the source serves only the last 28", extra: { ...sp?.summary, daily: sp?.daily, resources: sp?.resources, keys: sp?.keys },
      },
      {
        id: "orbio", name: "Orbio", url: "https://www.orbio.so", kind: "router", coverage: "all", dayBasis: "Complete UTC days",
        extra: ob ? { totals: ob.totals, firstUsageDay: ob.firstUsageDay, payments: ob.payments, retail: ob.retail, inferenceSales: ob.inferenceSales, protocol: without(ob.protocol, "book") } : {},
      },
    ],
    providers: providers.list(),
    labs: catalog.labs(),
    models: catalog.list(),
    listings,
    usage,
    totals,
    health,
    instruments: buildInstruments({ surplus: sp, orbio: ob, ostr: ostrSeries, diem: diemData }, { catalog, listings, usage, through }),
    errors,
  };
}

if (import.meta.main) {
  const s = await collect();
  console.log(JSON.stringify(s, null, 2));
}
