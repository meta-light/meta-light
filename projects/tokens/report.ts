import { collect } from "./collect";
import type { Snapshot } from "./schema";

const out = process.argv.find((a) => a.endsWith(".html")) ?? new URL("./report.html", import.meta.url).pathname;

const snap = await collect();
for (const e of snap.errors) console.error(e);

const pick = <T extends object>(o: T, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k, v]) => keys.includes(k) && v !== undefined));
const antseedDay = ["free_tokens", "settled_micro", "buyers", "sellers"];
const page = {
  generated: snap.generated,
  through: snap.through,
  errors: snap.errors,
  marketplaces: snap.marketplaces.map((m) => ({
    ...pick(m, ["id", "name", "url", "kind", "dayBasis", "coverage"]),
    extra:
      m.id === "antseed" ? { sellers: m.extra.sellers, health: pick((m.extra.health ?? {}) as object, ["services", "healthy", "failing", "sellers_reporting", "sellers_failing", "requests_last_hour"]) }
      : m.id === "openrouter" ? { weekly: m.extra.weekly }
      : {},
  })),
  providers: snap.providers.map((p) => ({ id: p.id, name: p.name, tracked: p.tracked, channels: [...new Set(p.aliases.map((a) => a.channel))] })),
  labs: snap.labs,
  models: snap.models.map((m) => pick(m, ["id", "name", "lab", "context", "matched"])),
  listings: snap.listings.map((l) => pick(l, ["channel", "provider", "model", "variant", "price", "priceMax", "context", "status"])),
  usage: snap.usage.map((u) => ({
    ...pick(u, ["channel", "provider", "model", "date", "tokens", "requests"]),
    ...(u.channel === "antseed" && u.extra ? { extra: pick(u.extra, antseedDay) } : {}),
  })),
  totals: snap.totals.filter((t) => t.channel === "antseed").map((t) => ({ ...pick(t, ["channel", "model", "days", "tokens"]), rawModel: t.extra?.rawModel })),
  health: snap.health
    .filter((h) => h.model || h.channel !== "direct")
    .map((h) => pick(h, ["channel", "provider", "model", "variant", "window", "uptime", "p50LatencyMs", "p50TokensPerSec", "ttftMs", "requests"])),
  instruments: snap.instruments,
} satisfies Partial<Record<keyof Snapshot, unknown>>;

const template = await Bun.file(new URL("./report-template.html", import.meta.url)).text();
await Bun.write(out, template.replace("/*DATA*/null", JSON.stringify(page).replaceAll("</", "<\\/")));
console.log(`wrote ${out}`);
