import { insertRows, type Sql, upsert } from '../database/sql';
import { getJson } from '../trading/data/interval';
import type { Job } from './collectors';

export const NOCK_MERGE_MINING_URL = 'https://nockscan.com/api/v1/merge-mining';

interface PearlWindow {
  pearlBlocks: number;
  tagged: number;
  matched: number;
  share: number;
}

interface AiShare {
  totalAi: number;
  declaredAi: number;
  share: number;
}

export interface NockMiner {
  address: string;
  declared24h: number;
  landed24h: number;
  declared7d: number;
  landed7d: number;
}

export interface MergeMining {
  tipHeight: number;
  pearlWindows: { h24: PearlWindow; d7: PearlWindow };
  miners: NockMiner[];
  declared: AiShare;
  window2016: AiShare;
  pearl: { taggedBlocks: number; matchedPairs: number };
}

const SUMMARY_COLS = [
  'day',
  't',
  'tip_height',
  'h24_pearl_blocks',
  'h24_tagged',
  'h24_matched',
  'h24_share',
  'd7_pearl_blocks',
  'd7_tagged',
  'd7_matched',
  'd7_share',
  'declared_total_ai',
  'declared_declared_ai',
  'declared_share',
  'window2016_total_ai',
  'window2016_declared_ai',
  'window2016_share',
  'pearl_tagged_blocks',
  'pearl_matched_pairs',
  'miner_count',
] as const;

const MINER_COLS = ['day', 'address', 't', 'tip_height', 'declared_24h', 'landed_24h', 'declared_7d', 'landed_7d'] as const;

const window = (w: PearlWindow) => [w.pearlBlocks, w.tagged, w.matched, w.share];
const ai = (a: AiShare) => [a.totalAi, a.declaredAi, a.share];

export function nockRows(m: MergeMining, t: number): { day: string; summary: unknown[]; miners: unknown[][] } {
  const day = new Date(t).toISOString().slice(0, 10);
  return {
    day,
    summary: [
      day,
      t,
      m.tipHeight,
      ...window(m.pearlWindows.h24),
      ...window(m.pearlWindows.d7),
      ...ai(m.declared),
      ...ai(m.window2016),
      m.pearl.taggedBlocks,
      m.pearl.matchedPairs,
      m.miners.length,
    ],
    miners: m.miners.map((x) => [day, x.address, t, m.tipHeight, x.declared24h, x.landed24h, x.declared7d, x.landed7d]),
  };
}

export async function saveNock(sql: Sql, m: MergeMining, t: number): Promise<number> {
  const { day, summary, miners } = nockRows(m, t);
  await insertRows(sql, 'nock_merge_mining', SUMMARY_COLS, [summary], upsert(['day'], SUMMARY_COLS));
  // A same-day rerun replaces the miner list, so a miner that dropped out doesn't linger.
  await sql.run('DELETE FROM nock_merge_miners WHERE day = ?', [day]);
  return 1 + (await insertRows(sql, 'nock_merge_miners', MINER_COLS, miners));
}

export const nockMergeMining: Job = async (sql, now) => {
  const m = await getJson<MergeMining>(NOCK_MERGE_MINING_URL);
  if (!Number.isFinite(m.tipHeight) || !m.pearlWindows?.h24 || !Array.isArray(m.miners)) {
    throw new Error(`unexpected merge-mining payload: ${JSON.stringify(m).slice(0, 300)}`);
  }
  return saveNock(sql, m, now);
};
