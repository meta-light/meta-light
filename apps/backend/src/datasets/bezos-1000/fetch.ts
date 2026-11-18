import { writeFile } from 'node:fs/promises';

const BASE_URL = 'https://bezos1000.com/api';
const ENDPOINTS = { entrepreneurs: 'entrepreneurs', stats: 'stats' } as const;

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

for (const [name, path] of Object.entries(ENDPOINTS)) {
  const data = await getJson(path);
  if (name === 'entrepreneurs' && (!Array.isArray(data) || data.length === 0)) {
    throw new Error('entrepreneurs: expected a non-empty array');
  }
  const file = new URL(`./${name}.json`, import.meta.url);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${file.pathname}${Array.isArray(data) ? ` (${data.length} rows)` : ''}`);
}
