import { writeFile } from 'node:fs/promises';

const RAW_BASE = 'https://raw.githubusercontent.com/TheEconomist/big-mac-data/master';
const TEXT_COLUMNS = new Set(['date', 'iso_a3', 'currency_code', 'name']);

type Row = Record<string, string | number | null>;

async function getCsv(path: string): Promise<Row[]> {
  const res = await fetch(`${RAW_BASE}/${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  // The historical file uses bare \r line endings.
  const lines = (await res.text()).split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  if (lines.some((line) => line.includes('"'))) throw new Error(`${path}: quoted CSV fields aren't handled`);
  const [header, ...body] = lines.map((line) => line.split(','));
  if (!header || body.length === 0) throw new Error(`${path}: empty CSV`);
  return body.map((cells) => {
    if (cells.length !== header.length) throw new Error(`${path}: row has ${cells.length} cells, header has ${header.length}`);
    const row: Row = {};
    header.forEach((column, i) => {
      const cell = cells[i]!;
      if (TEXT_COLUMNS.has(column)) row[column] = cell;
      else if (cell === '' || cell === 'NA') row[column] = null;
      else {
        const value = Number(cell);
        if (Number.isNaN(value)) throw new Error(`${path}: ${column} = "${cell}" isn't a number`);
        row[column] = value;
      }
    });
    row.date = String(row.date).slice(0, 10);
    return row;
  });
}

const byDateThenCountry = (a: Row, b: Row) =>
  String(a.date).localeCompare(String(b.date)) || String(a.iso_a3).localeCompare(String(b.iso_a3));

async function write(name: string, rows: Row[]): Promise<void> {
  const file = new URL(`./${name}.json`, import.meta.url);
  await writeFile(file, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`wrote ${file.pathname} (${rows.length} rows)`);
}

const [historical, current, fullIndex] = await Promise.all([
  getCsv('source-data/big-mac-historical-source-data.csv'),
  getCsv('source-data/big-mac-source-data-v2.csv'),
  getCsv('output-data/big-mac-full-index.csv'),
]);

const input = [
  ...historical.map((row) => ({ ...row, GDP_dollar: null, GDP_local: null })),
  ...current,
].sort(byDateThenCountry);

await write('input', input);
await write('output', fullIndex.sort(byDateThenCountry));
