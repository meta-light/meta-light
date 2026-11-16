import type { Sql } from '../database/sql';

export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export const DEFAULT_CACHE_DIR = decodeURIComponent(new URL('../../.cache', import.meta.url).pathname);

export function diskStore(dir: string): KvStore {
  const fs = import('node:fs/promises');
  const path = import('node:path');
  return {
    async get(key) {
      const [{ readFile }, { join }] = await Promise.all([fs, path]);
      try {
        return await readFile(join(dir, `${key}.json`), 'utf8');
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const [{ mkdir, writeFile }, { dirname, join }] = await Promise.all([fs, path]);
      const file = join(dir, `${key}.json`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, value);
    },
  };
}

const PART_CHARS = 500_000;

export function sqlStore(sql: Sql): KvStore {
  return {
    async get(key) {
      const rows = await sql.all<{ part: number; parts: number; value: string }>(
        'SELECT part, parts, value FROM fetch_cache WHERE key = ? ORDER BY part',
        [key],
      );
      if (!rows.length || rows.length !== rows[0]!.parts) return null;
      return rows.map((r) => r.value).join('');
    },
    async put(key, value) {
      const parts = Math.max(1, Math.ceil(value.length / PART_CHARS));
      await sql.run('DELETE FROM fetch_cache WHERE key = ?', [key]);
      for (let i = 0; i < parts; i++) {
        await sql.run('INSERT INTO fetch_cache (key, part, parts, value) VALUES (?, ?, ?, ?)', [
          key,
          i,
          parts,
          value.slice(i * PART_CHARS, (i + 1) * PART_CHARS),
        ]);
      }
    },
  };
}

let current: KvStore | null = null;

export const getStore = (): KvStore => (current ??= diskStore(DEFAULT_CACHE_DIR));

export const setStore = (store: KvStore | null): void => {
  current = store;
};
