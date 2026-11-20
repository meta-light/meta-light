import { getJson } from "./index";
import type { Price } from "./schema";

export type DirectModel = { id: string; name: string; keys: Array<string | null | undefined>; price?: Price; context?: number; status?: string; raw: Record<string, unknown> };

const perMillion = (perToken: unknown) => (perToken == null || perToken === "" ? undefined : Number(perToken) * 1e6);

export async function ambientModels(): Promise<DirectModel[]> {
  const { data } = await getJson("https://api.ambient.xyz/v1/models");
  return (data as any[]).map((m) => ({
    id: m.id, name: m.name, keys: [m.openrouter?.slug, m.hugging_face_id, m.name],
    price: { prompt: m.pricing.input, completion: m.pricing.output, cacheRead: perMillion(m.pricing.input_cache_read) },
    context: m.context_length, status: m.is_ready ? "ready" : "not ready", raw: m,
  }));
}

export async function primeIntellectModels(): Promise<DirectModel[]> {
  const { data } = await getJson("https://api.pinference.ai/api/v1/models");
  return (data as any[])
    .filter((m) => m.serving === "hosted")
    .map((m) => ({
      id: m.id, name: m.display_name ?? m.id, keys: [m.id, m.display_name],
      price: m.pricing?.input_usd_per_mtok == null ? undefined : { prompt: m.pricing.input_usd_per_mtok, completion: m.pricing.output_usd_per_mtok, cacheRead: m.pricing.cache_read_usd_per_mtok ?? undefined },
      context: m.context_window ?? m.context_length, raw: m,
    }));
}

if (import.meta.main) {
  for (const [name, f] of [["Ambient", ambientModels], ["Prime Intellect", primeIntellectModels]] as const) {
    const ms = await f();
    console.log(`${name}: ${ms.length} models`);
    console.table(ms.map((m) => ({ id: m.id, in: m.price?.prompt, out: m.price?.completion, context: m.context })));
  }
}
