import { sleep } from '../data/interval';
import { getStore } from '../store';

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  keep: boolean | ((value: T) => boolean) = true,
): Promise<T> {
  const store = getStore();
  const hit = await store.get(`weather/${key}`);
  if (hit != null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
    }
  }
  const value = await fetcher();
  if (typeof keep === 'function' ? keep(value) : keep) await store.put(`weather/${key}`, JSON.stringify(value));
  return value;
}

export async function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.text();
    if ((res.status !== 429 && res.status < 500) || attempt >= 8) {
      throw new Error(`GET ${url} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const after = Number(res.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : Math.min(60_000, 2000 * 2 ** attempt));
  }
}

export async function getJsonText<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const text = await getText(url, { accept: 'application/json' });
    try {
      return JSON.parse(text) as T;
    } catch {
      if (attempt >= 4) throw new Error(`GET ${url} -> non-JSON body: ${text.slice(0, 300)}`);
      await sleep(2000 * 2 ** attempt);
    }
  }
}

export function rateLimiter(gapMs: number): () => Promise<void> {
  let next = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + gapMs;
    if (at > now) await sleep(at - now);
  };
}

export async function mapPool<T, R>(items: readonly T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]!, k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
