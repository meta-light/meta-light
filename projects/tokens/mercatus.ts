import { getJson } from "./index";
import type { Price } from "./schema";

export const OSTR_SERIES = "IR-OW-NOV26";

type Rates = { input: string; output: string; cacheRead?: string };
export type OstrItem = {
  gatewayModelId: string;
  snapshot: Partial<Rates> & { modelVersion: string; timeOfDay?: { utcOffsetMinutes: number; tiers: Array<{ startMinute: number; endMinute: number; usdPerMillionTokens: Rates }> } } & Record<string, unknown>;
} & Record<string, unknown>;

export async function ostr(series = OSTR_SERIES) {
  const { data } = await getJson(`https://www.mercatus-ai.com/api/ostr/series/${series}/menu`);
  return data as { symbol: string; faceValueUsd: string; serviceStart: string; serviceEnd: string; status: string; publishedAt: string; menu: OstrItem[] } & Record<string, unknown>;
}

export function ostrRates(item: OstrItem): { peak?: Price; offPeak?: Price } {
  const s = item.snapshot;
  const rates = s.timeOfDay?.tiers.map((t) => t.usdPerMillionTokens) ?? (s.input == null ? [] : [s as Rates]);
  const tiers = rates.map((r) => ({
    prompt: Number(r.input),
    completion: Number(r.output),
    cacheRead: r.cacheRead == null ? undefined : Number(r.cacheRead),
  }));
  tiers.sort((a, b) => b.prompt - a.prompt);
  return { peak: tiers[0], offPeak: tiers.at(-1) };
}

if (import.meta.main) {
  const s = await ostr();
  console.log(`${s.symbol}: $${s.faceValueUsd} face, ${s.serviceStart}..${s.serviceEnd}, ${s.status}`);
  const show = (p?: Price) => (p ? `$${p.prompt}/$${p.completion}` : "—");
  console.table(s.menu.map((m) => { const r = ostrRates(m); return { model: m.snapshot.modelVersion, peak: show(r.peak), offPeak: show(r.offPeak) }; }));
}
