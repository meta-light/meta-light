import { getJson } from "./index";

const API = "https://venicestats.com/api";
type Point = { t: number; v: number };

export async function diem() {
  const [metrics, charts, usage] = await Promise.all([getJson(`${API}/metrics`), getJson(`${API}/charts?period=90d`), getJson(`${API}/diem-usage`)]);
  return {
    metrics: metrics as Record<string, number> & { diemPrice: number; diemSupply: number; diemStaked: number },
    price: charts.diemPrice as Point[],
    supply: charts.diemSupply as Point[],
    usage: usage as { days: Array<{ t: number; consumed: number; staked: number; utilizationPct: number }>; summary: Record<string, any> },
  };
}

export const daily = (points: Point[]) => [...new Map(points.map((p) => [new Date(p.t).toISOString().slice(0, 10), p.v])).entries()].map(([date, value]) => ({ date, value }));

if (import.meta.main) {
  const d = await diem();
  console.log(`DIEM $${d.metrics.diemPrice.toFixed(0)}, supply ${d.metrics.diemSupply.toFixed(0)}, implied yield ${((365 / d.metrics.diemPrice) * 100).toFixed(1)}%`);
  console.table(daily(d.price).slice(-5));
}
