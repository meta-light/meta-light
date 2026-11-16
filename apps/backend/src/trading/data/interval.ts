import type { DataBar } from '../strategies/engine/index';

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function intervalMs(interval: string): number {
  const m = /^(\d+)(m|h|d)$/.exec(interval.trim().toLowerCase());
  if (!m) throw new Error(`Unsupported interval "${interval}" (use e.g. 1m, 15m, 1h, 1d)`);
  return Number(m[1]) * UNIT_MS[m[2] as keyof typeof UNIT_MS];
}

export const isDaily = (interval: string): boolean =>
  intervalMs(interval) >= UNIT_MS.d;

export function stamp(openMs: number, interval: string): string {
  const iso = new Date(openMs).toISOString();
  return isDaily(interval) ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`;
}

export type Row = [number, number, number, number, number, number];

export const toBar = (r: Row, interval: string): DataBar => ({
  timestamp: stamp(r[0], interval),
  open: r[1],
  high: r[2],
  low: r[3],
  close: r[4],
  volume: r[5],
});

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const USER_AGENT = 'Mozilla/5.0 (compatible; market-data-client/1.0)';

export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
  onResponse?: (res: Response) => Promise<void> | void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers } });
    if (res.ok) {
      await onResponse?.(res);
      return (await res.json()) as T;
    }
    const retryable = res.status === 429 || res.status === 418 || res.status >= 500;
    if (!retryable || attempt >= 5) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`GET ${url} -> ${res.status}: ${body}`);
    }
    const after = Number(res.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : 1000 * 2 ** attempt);
  }
}
