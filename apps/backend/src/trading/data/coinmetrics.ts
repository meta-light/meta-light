import { getJson, intervalMs, type Row } from './interval';

const BASE = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const DAY = 86_400_000;

interface Page {
  data: Record<string, string>[];
  next_page_url?: string;
}

export async function coinmetricsDaily(asset: string, metric: string): Promise<[ms: number, value: number][]> {
  const out: [number, number][] = [];
  let url: string | undefined =
    `${BASE}?assets=${asset}&metrics=${metric}&frequency=1d&page_size=10000&start_time=2009-01-01`;
  while (url) {
    const page: Page = await getJson<Page>(url);
    for (const r of page.data) {
      const v = Number(r[metric]);
      if (Number.isFinite(v)) out.push([Date.parse(r.time!), v]);
    }
    url = page.next_page_url;
  }
  return out;
}

const memo = new Map<string, Promise<Row[]>>();

export async function fetchCoinmetrics(
  asset: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Row[]> {
  if (intervalMs(interval) !== DAY) throw new Error('Coin Metrics source only serves 1d bars');
  const id = asset.toLowerCase().split('-')[0]!;
  let rows = memo.get(id);
  if (!rows) {
    rows = coinmetricsDaily(id, 'PriceUSD').then((pts) =>
      pts.filter(([, p]) => p > 0).map(([t, p]): Row => [t, p, p, p, p, 0]),
    );
    rows.catch(() => memo.delete(id));
    memo.set(id, rows);
  }
  return (await rows).filter((r) => r[0] >= startMs && r[0] < endMs);
}
