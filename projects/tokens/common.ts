export type Price = { prompt: number; completion: number };
export type Offer = Price & { provider: string; providerName: string };

export const fmtTokens = (n: number) =>
  n === 0 ? "0"
  : n >= 1e12 ? `${(n / 1e12).toFixed(2)}T`
  : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : `${n}`;

export const fmtChange = (now: number, then: number) =>
  !then ? "—" : now > then * 100 ? "new" : `${now >= then ? "+" : ""}${((now / then - 1) * 100).toFixed(1)}%`;
export const fmtPct = (p: number | null | undefined) => (p == null ? "—" : `${p.toFixed(1)}%`);
const fmtPrices = (p: Price) => `$${+p.prompt.toFixed(3)}/$${+p.completion.toFixed(3)}`;

const blended = (p: Price) => (3 * p.prompt + p.completion) / 4;
const cheapest = <T extends Price>(ps: T[]) => ps.reduce<T | undefined>((a, p) => (!a || blended(p) < blended(a) ? p : a), undefined);

export function priceRow(model: string, offers: Offer[], tracked: string[]) {
  const priced = offers.filter((o) => o.prompt >= 0 && o.completion >= 0 && o.prompt + o.completion > 0);
  const best = cheapest(priced);
  const row: Record<string, string | number> = { Model: model };
  for (const slug of tracked) {
    const own = cheapest(priced.filter((o) => o.provider === slug));
    row[slug] = own ? `${fmtPrices(own)}${blended(own) <= blended(best!) ? " ★" : ""}` : "";
  }
  row.Cheapest = best?.providerName ?? "—";
  row["Cheapest in/out"] = best ? fmtPrices(best) : "—";
  row["# Prov"] = new Set(offers.map((o) => o.provider)).size;
  return row;
}
