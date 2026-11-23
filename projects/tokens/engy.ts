import { flight, jsonAfter } from "./index";
import type { Price } from "./schema";

type Known<T> = { state: string; value?: T };
type Rate = Known<{ micro: number; unit: string }>;
type Fact = { value: string; sourceUrl: string; checkedAt: string };
export type EngyModel = Record<string, unknown> & {
  id: string;
  input: Rate;
  output: Rate;
  cachedInput: Rate;
  context: Known<number>;
  success24h: Known<number>;
  facts?: { developer?: Fact; checkpoint?: Fact };
};
type View = {
  series: Array<{ key: string; label: string }>;
  ranges: Array<{ days: number; rows: Array<{ date: string; values: Record<string, number>; open: unknown }> }>;
  through: string;
  population: string;
};

export async function engy() {
  const [usage, pricing] = await Promise.all([flight("https://engy.ai/usage"), flight("https://engy.ai/pricing")]);
  const view = jsonAfter<View>(usage, '"view":');
  const { rows } = view.ranges.reduce((a, b) => (b.days > a.days ? b : a));
  const daily = rows.filter((r) => !r.open).map((r) => ({ date: r.date, models: view.series.map((s) => ({ model: s.label, tokens: r.values[s.key] ?? 0 })) }));
  return { through: view.through, population: view.population, daily, models: jsonAfter<EngyModel[]>(pricing, '"entries":') };
}

// `micro` is micro-USD per 1M tokens.
const perM = (r: Rate) => (r.state === "known" && r.value ? r.value.micro / 1e6 : undefined);
export function engyPrice(m: EngyModel): Price | undefined {
  const [prompt, completion] = [perM(m.input), perM(m.output)];
  return prompt == null || completion == null ? undefined : { prompt, completion, cacheRead: perM(m.cachedInput) };
}

if (import.meta.main) {
  const e = await engy();
  console.log(`${e.models.length} models priced; usage through ${e.through} (${e.population})`);
  console.table(e.models.map((m) => ({ id: m.id, ...engyPrice(m), context: m.context.value, ok24h: m.success24h.value })));
  console.table(e.daily.slice(-5).map((d) => ({ date: d.date, tokens: d.models.reduce((a, m) => a + m.tokens, 0) })));
}
