import type { Catalog } from "./catalog";
import { ostrRates, type ostr } from "./mercatus";
import type { orbio } from "./orbio";
import type { Instrument, Listing, Price, Usage } from "./schema";
import type { surplus } from "./surplus";
import { daily, type diem } from "./venicestats";

const REPORT_AS_OF = "2026-11-19";
const DAY = 86_400_000;

const blend = (p: Price) => (3 * p.prompt + p.completion) / 4;
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined);

type Sources = {
  surplus?: Awaited<ReturnType<typeof surplus>>;
  orbio?: Awaited<ReturnType<typeof orbio>>;
  ostr?: Awaited<ReturnType<typeof ostr>>;
  diem?: Awaited<ReturnType<typeof diem>>;
};

export function buildInstruments(src: Sources, ctx: { catalog: Catalog; listings: Listing[]; usage: Usage[]; through: string }): Instrument[] {
  const asOf = new Date().toISOString();
  const orBlends = new Map<string, number[]>();
  for (const l of ctx.listings)
    if (l.channel === "openrouter" && l.price && l.price.prompt > 0) orBlends.set(l.model, [...(orBlends.get(l.model) ?? []), blend(l.price)]);
  const retail = (model: string) => median(orBlends.get(model) ?? []);
  const discountVsOr = (model: string, p?: Price) => {
    const ref = retail(model);
    return p && ref ? 1 - blend(p) / ref : undefined;
  };
  const since30 = new Date(Date.parse(ctx.through) - 29 * DAY).toISOString().slice(0, 10);
  const out: Instrument[] = [];

  if (src.surplus) {
    const s = src.surplus.summary as Record<string, number>;
    out.push({
      id: "surplus-spot", name: "Surplus spot", issuer: "Surplus Intelligence", class: "spot", venue: "Surplus", url: "https://www.surplusintelligence.ai/markets",
      claim: "Per-request inference on resold upstream capacity", discount: s.saved_24h / (s.saved_24h + s.volume_24h),
      size: { value: s.volume_24h / 1e6, unit: "usd", label: "24h volume" }, source: "live", asOf,
      notes: "Discount = buyer savings ÷ (savings + spend), last 24h.", extra: { markets: src.surplus.markets.length, sellersLive: s.sellers_live },
    });
  }

  const liquid = ctx.listings.filter((l) => l.channel === "liquid").flatMap((l) => discountVsOr(l.model, l.price) ?? []);
  const liquidTokens = ctx.usage.filter((u) => u.channel === "liquid" && u.date >= since30 && u.date <= ctx.through).reduce((a, u) => a + u.tokens, 0);
  out.push({
    id: "liquid-spot", name: "Liquid spot", issuer: "Liquid Inference", class: "spot", venue: "Liquid", url: "https://inference.ai.exchange",
    claim: "Per-request inference from an exchange-listed provider", discount: median(liquid),
    size: { value: liquidTokens, unit: "tokens", label: "30d tokens" }, source: "live", asOf,
    notes: `Median over ${liquid.length} listings vs the median OpenRouter price, 3:1 input:output blend.`, extra: {},
  });

  if (src.ostr) {
    const o = src.ostr;
    const menu: Listing[] = o.menu.flatMap((m) => {
      const { peak, offPeak } = ostrRates(m);
      if (!peak) return [];
      const raw = m.snapshot.modelVersion;
      const model = ctx.catalog.match(raw) ?? raw;
      const or = orBlends.get(model) ?? [];
      const ref = { median: median(or), cheapest: or.length ? Math.min(...or) : undefined, blend: blend(peak), offPeakBlend: offPeak && blend(offPeak) };
      return [{ channel: "direct", provider: "mercatus", model, rawModel: raw, variant: "peak", price: peak, extra: { offPeak, ref } } satisfies Listing];
    });
    out.push({
      id: `mercatus-${o.symbol.toLowerCase()}`, name: `OSTR ${o.symbol}`, issuer: "Mercatus", class: "quantity", venue: "Mercatus", url: "https://www.mercatus-ai.com",
      claim: `$${o.faceValueUsd} of inference at fixed menu rates, ${o.serviceStart} to ${o.serviceEnd}`, face: Number(o.faceValueUsd),
      expiry: o.serviceEnd, menu, source: "live", asOf,
      notes: "No trade price is published, so no discount. Menu rates are compared with OpenRouter below.", extra: { status: o.status, publishedAt: o.publishedAt },
    });
  }

  out.push({
    id: "touchmark-forward", name: "Touchmark forward", issuer: "Touchmark", class: "quantity", venue: "OTC", url: "",
    claim: "A fixed quantity of tokens delivered later at a price set today", source: "report", asOf: REPORT_AS_OF,
    notes: "Priced 10–60% below retail.", extra: { discountRange: [0.1, 0.6] },
  });

  if (src.orbio) {
    const book = src.orbio.protocol.book;
    const asks = book.asks.map((a) => ({ discount: a.discountBps / 1e4, usd: Number(a.creditsMicroUsd) / 1e6, orders: a.orders }));
    const best = Math.max(...asks.map((a) => a.discount));
    out.push({
      id: "orbio-credit", name: "Orbio CREDIT", issuer: "Orbio", class: "dollar", venue: "Orbio", url: "https://www.orbio.so/analytics",
      claim: "$1 of Orbio inference at list price", price: 1 - best, face: 1, discount: best,
      size: { value: asks.reduce((a, x) => a + x.usd, 0), unit: "usd", label: "ask depth" }, source: "live", asOf: src.orbio.protocol.asOf ?? asOf,
      notes: "Price = best ask. The report cites ~51% with a ~$10K pool.",
      extra: { asks, bids: book.bids.map((b) => ({ discount: b.discountBps / 1e4, usd: Number(b.creditsMicroUsd) / 1e6, orders: b.orders })), stakers: src.orbio.protocol.totals.stakers },
    });
  }

  if (src.diem) {
    const m = src.diem.metrics;
    out.push({
      id: "venice-diem", name: "Venice DIEM", issuer: "Venice", class: "dollar", venue: "Base", url: "https://venicestats.com",
      claim: "$1/day of Venice inference, perpetual, while staked", price: m.diemPrice, yield: 365 / m.diemPrice, supply: m.diemSupply,
      history: [{ label: "DIEM price", unit: "usd", points: daily(src.diem.price) }], source: "live", asOf,
      notes: "Yield = $365 of inference a year ÷ price. Supply target 40K (report).",
      extra: { staked: m.diemStaked, targetSupply: 40_000, utilization: src.diem.usage.summary },
    });
  }

  out.push({
    id: "antseed-ants", name: "AntSeed ANTS staking", issuer: "AntSeed", class: "access", venue: "AntSeed", url: "https://antseedstats.com",
    claim: "Staked ANTS for seller access to the AntSeed network", discount: 0.5, source: "report", asOf: REPORT_AS_OF,
    notes: "Median seller price 50% below list. Early-withdrawal burn falls from 50% to 5%.", extra: { burn: { start: 0.5, end: 0.05 } },
  });

  return out;
}
