import { readFileSync } from 'node:fs';
import { type MergeMining, type NockMiner, saveNock } from '../../collect/nock';
import { restSql } from '../../database/client';
import { ensureRecorder } from '../../database/recorder';

function readCsv(name: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').trim().split('\n');
  const cols = header!.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [cols[i]!, v])));
}

async function main(): Promise<void> {
  const miners = new Map<string, NockMiner[]>();
  for (const r of readCsv('miners.csv')) {
    const list = miners.get(r.fetched_utc!) ?? [];
    list.push({
      address: r.address!,
      declared24h: +r.declared24h!,
      landed24h: +r.landed24h!,
      declared7d: +r.declared7d!,
      landed7d: +r.landed7d!,
    });
    miners.set(r.fetched_utc!, list);
  }

  const sql = restSql();
  await ensureRecorder(sql);
  for (const r of readCsv('summary.csv')) {
    const n = (k: string) => +r[k]!;
    const m: MergeMining = {
      tipHeight: n('tipHeight'),
      pearlWindows: {
        h24: { pearlBlocks: n('h24_pearlBlocks'), tagged: n('h24_tagged'), matched: n('h24_matched'), share: n('h24_share') },
        d7: { pearlBlocks: n('d7_pearlBlocks'), tagged: n('d7_tagged'), matched: n('d7_matched'), share: n('d7_share') },
      },
      miners: miners.get(r.fetched_utc!) ?? [],
      declared: { totalAi: n('declared_totalAi'), declaredAi: n('declared_declaredAi'), share: n('declared_share') },
      window2016: { totalAi: n('window2016_totalAi'), declaredAi: n('window2016_declaredAi'), share: n('window2016_share') },
      pearl: { taggedBlocks: n('pearl_taggedBlocks'), matchedPairs: n('pearl_matchedPairs') },
    };
    if (m.miners.length !== n('miner_count')) throw new Error(`${r.fetched_utc}: ${m.miners.length} miners, summary says ${r.miner_count}`);
    console.log(`${r.fetched_utc} tip ${m.tipHeight}: ${await saveNock(sql, m, Date.parse(r.fetched_utc!))} rows`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
