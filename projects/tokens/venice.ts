const API = "https://api.venice.ai/api/v1/models?type=text";

export type VeniceModel = {
  id: string;
  name: string;
  source: string | null;
  prompt: number;
  completion: number;
  cacheRead: number | null;
  context: number;
  privacy: string;
  offline: boolean;
  raw: Record<string, unknown>;
};

export async function veniceModels(): Promise<VeniceModel[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`${res.status} ${API}`);
  const { data } = (await res.json()) as { data: any[] };
  return data.map((m) => {
    const s = m.model_spec;
    return {
      id: m.id,
      name: s.name,
      source: s.modelSource ?? null,
      prompt: s.pricing.input.usd,
      completion: s.pricing.output.usd,
      cacheRead: s.pricing.cache_input?.usd ?? null,
      context: s.availableContextTokens,
      privacy: s.privacy,
      offline: s.offline,
      raw: m,
    };
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function openRouterIndex(models: Array<{ id: string; name: string; hugging_face_id?: string | null }>) {
  const index = new Map<string, string>();
  for (const m of models)
    for (const key of [m.id, m.id.split("/").pop()!, m.hugging_face_id ?? "", m.name.split(": ").pop()!])
      if (key && !index.has(norm(key))) index.set(norm(key), m.id);
  return (v: VeniceModel): string | undefined => {
    const repo = v.source?.split("huggingface.co/")[1]?.replace(/-(fp8|fp4|nvfp4|awq|gptq|int4|int8)$/i, "");
    for (const key of [repo, v.id, v.name]) if (key && index.has(norm(key))) return index.get(norm(key));
  };
}
