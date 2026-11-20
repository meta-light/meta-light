import type { Channel, Lab, Model, ModelAlias, Provider, ProviderAlias } from "./schema";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const PROVIDER_ALIASES: Record<string, string> = { akashml: "akash" };
export const providerId = (slug: string) => PROVIDER_ALIASES[slug] ?? slug;

export class Providers {
  private byId = new Map<string, Provider>();

  add(slug: string, name: string, tracked: boolean, alias?: Omit<ProviderAlias, "slug" | "name">) {
    const id = providerId(slug);
    const p = this.byId.get(id) ?? { id, name, tracked, aliases: [] };
    p.tracked ||= tracked;
    if (tracked && !this.byId.get(id)?.tracked) p.name = name;
    if (alias && !p.aliases.some((a) => a.channel === alias.channel && a.externalId === alias.externalId)) p.aliases.push({ ...alias, slug, name });
    this.byId.set(id, p);
    return id;
  }

  list = () => [...this.byId.values()].sort((a, b) => Number(b.tracked) - Number(a.tracked) || a.id.localeCompare(b.id));
}

const LAB_ALIASES: Record<string, string> = {
  moonshotai: "moonshotai", moonshot: "moonshotai", zhipuai: "z-ai", zai: "z-ai", zaiorg: "z-ai", alibaba: "qwen", qwen: "qwen",
  meta: "meta", metallama: "meta", llama: "meta", muse: "meta", claude: "anthropic", anthropic: "anthropic", gpt: "openai",
  openai: "openai", glm: "z-ai", kimi: "moonshotai", deepseek: "deepseek", gemini: "google", gemma: "google", google: "google",
  nemotron: "nvidia", nvidia: "nvidia", mistral: "mistralai", mistralai: "mistralai", minimax: "minimax", grok: "x-ai", xai: "x-ai",
};

const labFromHint = (s: string) => {
  const n = norm(s);
  const hit = Object.keys(LAB_ALIASES).filter((k) => n.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return hit ? LAB_ALIASES[hit]! : undefined;
};

type OrModel = Record<string, any> & { id: string; name: string };

const VARIANT = /(:thinking|:free|:extended|-(?:fp8|fp4|nvfp4|awq|gptq|int4|int8|bf16))$/i;
export const splitVariant = (raw: string) => {
  const m = raw.match(VARIANT);
  return m ? { base: raw.slice(0, -m[1]!.length), variant: m[1]!.replace(/^[:-]/, "") } : { base: raw, variant: undefined };
};

export class Catalog {
  private index = new Map<string, string>();
  private or = new Map<string, OrModel>();
  private models = new Map<string, Model>();
  private labNames = new Map<string, string>();

  constructor(catalog: OrModel[]) {
    for (const m of catalog) {
      this.or.set(m.id, m);
      const lab = m.id.split("/")[0]!;
      if (m.name.includes(": ") && !this.labNames.has(lab)) this.labNames.set(lab, m.name.split(": ")[0]!);
      for (const key of [m.id, m.canonical_slug, m.hugging_face_id, m.id.split("/").pop(), m.name.split(": ").pop(), lab + (m.name.split(": ").pop() ?? "")])
        if (key && !this.index.has(norm(key))) this.index.set(norm(key), m.id);
    }
  }

  match(...keys: Array<string | null | undefined>): string | undefined {
    for (const k of keys) {
      if (!k) continue;
      const base = splitVariant(k.includes("huggingface.co/") ? k.split("huggingface.co/")[1]! : k).base;
      for (const c of [base, base.split("/").pop()!]) if (this.index.has(norm(c))) return this.index.get(norm(c));
    }
  }

  add(alias: ModelAlias, hints: { keys?: Array<string | null | undefined>; lab?: string | null; name?: string; context?: number } = {}): string {
    const orId = this.match(alias.raw, ...(hints.keys ?? []));
    const id = orId ?? `${alias.channel}:${splitVariant(alias.raw).base}`;
    let m = this.models.get(id);
    if (!m) {
      const or = orId ? this.or.get(orId) : undefined;
      const orLab = orId?.split("/")[0];
      const lab = (orLab && (LAB_ALIASES[norm(orLab)] ?? orLab)) ?? labFromHint(hints.lab ?? "") ?? labFromHint(alias.raw) ?? labFromHint(hints.name ?? "") ?? "unknown";
      m = or
        ? { id, name: or.name.split(": ").pop()!, lab, context: or.context_length, matched: true, aliases: [], extra: or }
        : { id, name: hints.name ?? alias.raw, lab, context: hints.context, matched: false, aliases: [], extra: {} };
      this.models.set(id, m);
    }
    if (!m.aliases.some((a) => a.channel === alias.channel && a.provider === alias.provider && a.raw === alias.raw)) m.aliases.push(alias);
    return id;
  }

  find(channel: Channel, raw: string): string | undefined {
    const orId = this.match(raw);
    if (orId && this.models.has(orId)) return orId;
    const local = `${channel}:${splitVariant(raw).base}`;
    if (this.models.has(local)) return local;
    for (const m of this.models.values()) if (m.aliases.some((a) => a.channel === channel && a.raw === raw)) return m.id;
  }

  has = (id: string) => this.models.has(id);
  matchedIds = () => [...this.models.values()].filter((m) => m.matched).map((m) => m.id);
  list = () => [...this.models.values()].sort((a, b) => a.id.localeCompare(b.id));

  labs(): Lab[] {
    const ids = new Set(this.list().map((m) => m.lab));
    return [...ids].sort().map((id) => ({ id, name: this.labNames.get(id) ?? id }));
  }
}
