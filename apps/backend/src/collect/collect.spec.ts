import { insertRows, MAX_PARAMS, type Sql, upsert } from '../database/sql';
import { recorderStatements } from '../database/recorder';
import { sqlStore } from '../trading/store';
import { runJobs } from './collectors';
import { type MergeMining, saveNock } from './nock';
import { bucketRow, metarTempC, toMarketEvent, type EventRow } from './records';

function fakeSql(answers: Record<string, unknown[]> = {}): Sql & { calls: { query: string; params: unknown[] }[] } {
  const calls: { query: string; params: unknown[] }[] = [];
  return {
    calls,
    async run(query, params = []) {
      calls.push({ query, params });
    },
    async all<T>(query: string, params: unknown[] = []): Promise<T[]> {
      calls.push({ query, params });
      const hit = Object.keys(answers).find((k) => query.startsWith(k));
      return (hit ? answers[hit] : []) as T[];
    },
  };
}

describe('insertRows', () => {
  it('chunks under the D1 parameter cap', async () => {
    const sql = fakeSql();
    const rows = Array.from({ length: 25 }, (_, i) => [i, `a${i}`, i * 2, null, 'x', 'y', 'z', 'w', 'v']);
    const n = await insertRows(sql, 't', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], rows, 'ON CONFLICT DO NOTHING');
    expect(n).toBe(25);
    expect(sql.calls.map((c) => c.params.length)).toEqual([99, 99, 27]);
    for (const c of sql.calls) {
      expect(c.params.length).toBeLessThanOrEqual(MAX_PARAMS);
      expect(c.query.match(/\?/g)!.length).toBe(c.params.length);
      expect(c.query).toMatch(/^INSERT INTO t \(a, b, c, d, e, f, g, h, i\) VALUES \(.+\) ON CONFLICT DO NOTHING$/);
    }
    expect(sql.calls.flatMap((c) => c.params)).toEqual(rows.flat());
  });

  it('writes nothing for no rows', async () => {
    const sql = fakeSql();
    expect(await insertRows(sql, 't', ['a'], [])).toBe(0);
    expect(sql.calls).toEqual([]);
  });

  it('builds upsert clauses', () => {
    expect(upsert(['a', 'b'], ['a', 'b', 'c', 'd'])).toBe('ON CONFLICT (a, b) DO UPDATE SET c = excluded.c, d = excluded.d');
    expect(upsert(['a'], ['a'])).toBe('ON CONFLICT (a) DO NOTHING');
  });
});

describe('recorder schema', () => {
  it('splits into idempotent statements', () => {
    const s = recorderStatements();
    expect(s.length).toBe(12);
    for (const q of s) expect(q).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS/);
  });
});

describe('sqlStore', () => {
  it('splits large values into parts and reassembles them', async () => {
    const sql = fakeSql();
    const value = 'x'.repeat(1_200_000);
    await sqlStore(sql).put('k', value);
    const inserts = sql.calls.filter((c) => c.query.startsWith('INSERT'));
    expect(sql.calls[0]!.query).toMatch(/^DELETE FROM fetch_cache/);
    expect(inserts.map((c) => [c.params[1], c.params[2]])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
    const rows = inserts.map((c) => ({ part: c.params[1], parts: c.params[2], value: c.params[3] }));
    expect(await sqlStore(fakeSql({ SELECT: rows })).get('k')).toBe(value);
  });

  it('treats a partial write as a miss', async () => {
    const rows = [{ part: 0, parts: 2, value: 'a' }];
    expect(await sqlStore(fakeSql({ SELECT: rows })).get('k')).toBeNull();
    expect(await sqlStore(fakeSql()).get('k')).toBeNull();
  });
});

describe('toMarketEvent', () => {
  const row = (results: Record<string, 0 | 1> | null): EventRow => ({
    venue: 'kalshi',
    event_id: 'KXHIGHNY-26NOV15',
    city: 'nyc',
    date: '2026-11-15',
    close_ms: 1_700_000_000_000,
    fee: 0.07,
    buckets: JSON.stringify([
      bucketRow('B2', '52-53', 52, 53),
      bucketRow('T1', '51 or below', -Infinity, 51),
      bucketRow('T3', '54 or above', 54, Infinity),
    ]),
    results: results && JSON.stringify(results),
    settled_high: 53,
  });
  const snaps = [
    { event_id: 'x', t: 2000, quotes: JSON.stringify({ T1: [0.1, 0.12, 5, 5], B2: [0.6, 0.65, 1, 1], T3: [0, 1, null, null] }) },
    { event_id: 'x', t: 1000, quotes: JSON.stringify({ T1: [0.2, 0.22, 5, 5], B2: [null, 0.5, null, 3] }) },
  ];

  it('rebuilds buckets in strike order with time-sorted quotes', () => {
    const ev = toMarketEvent(row({ T1: 0, B2: 1, T3: 0 }), snaps)!;
    expect(ev.buckets.map((b) => [b.id, b.lo, b.hi, b.result])).toEqual([
      ['T1', -Infinity, 51, 0],
      ['B2', 52, 53, 1],
      ['T3', 54, Infinity, 0],
    ]);
    expect(ev.buckets[0]!.quotes).toEqual([
      { t: 1000, bid: 0.2, ask: 0.22 },
      { t: 2000, bid: 0.1, ask: 0.12 },
    ]);
    expect(ev.buckets[2]!.quotes).toEqual([{ t: 2000, bid: null, ask: null }]);
    expect(ev.fee).toEqual({ venue: 'kalshi', rate: 0.07 });
    expect(ev.settledHigh).toBe(53);
  });

  it('rejects unsettled, partial or ambiguous results', () => {
    expect(toMarketEvent(row(null), snaps)).toBeNull();
    expect(toMarketEvent(row({ T1: 0, B2: 1 }), snaps)).toBeNull();
    expect(toMarketEvent(row({ T1: 1, B2: 1, T3: 0 }), snaps)).toBeNull();
    expect(toMarketEvent(row({ T1: 0, B2: 0, T3: 0 }), snaps)).toBeNull();
  });
});

describe('metarTempC', () => {
  it('prefers the tenths T-group', () => {
    expect(metarTempC('KNYC 151751Z 27008KT 10SM CLR 12/02 A3012 RMK AO2 T01220017', 12)).toBe(12.2);
    expect(metarTempC('KORD 151751Z 27008KT 10SM CLR M03/M08 A3012 RMK AO2 T10331078', -3)).toBe(-3.3);
    expect(metarTempC('KMIA 151812Z 09012KT 10SM FEW030 28/22 A3001 RMK AO2 T0283', 28)).toBe(28.3);
  });

  it('falls back to the whole-degree temp', () => {
    expect(metarTempC('KLAX 151753Z 25010KT 10SM CLR 21/12 A2995 RMK AO2', 21)).toBe(21);
    expect(metarTempC('KLAX 151753Z AUTO', null)).toBeNull();
  });
});

describe('saveNock', () => {
  const payload: MergeMining = {
    tipHeight: 188161,
    pearlWindows: {
      h24: { pearlBlocks: 424, tagged: 174, matched: 48, share: 0.41 },
      d7: { pearlBlocks: 3219, tagged: 1379, matched: 433, share: 0.428 },
    },
    miners: [
      { address: 'A', declared24h: 188, landed24h: 0, declared7d: 1124, landed7d: 2 },
      { address: 'B', declared24h: 99, landed24h: 24, declared7d: 706, landed7d: 215 },
    ],
    declared: { totalAi: 6987, declaredAi: 6987, share: 1 },
    window2016: { totalAi: 1410, declaredAi: 1410, share: 1 },
    pearl: { taggedBlocks: 19718, matchedPairs: 11028 },
  };

  it('upserts the day summary and replaces that day of miners', async () => {
    const sql = fakeSql();
    const t = Date.parse('2026-11-23T14:00:00Z');
    expect(await saveNock(sql, payload, t)).toBe(3);
    const [summary, del, miners] = sql.calls;
    expect(summary!.query).toMatch(/^INSERT INTO nock_merge_mining .* ON CONFLICT \(day\) DO UPDATE SET t = excluded\.t/);
    expect(summary!.params).toEqual([
      '2026-11-23', t, 188161, 424, 174, 48, 0.41, 3219, 1379, 433, 0.428, 6987, 6987, 1, 1410, 1410, 1, 19718, 11028, 2,
    ]);
    expect(del).toEqual({ query: 'DELETE FROM nock_merge_miners WHERE day = ?', params: ['2026-11-23'] });
    expect(miners!.params).toEqual([
      '2026-11-23', 'A', t, 188161, 188, 0, 1124, 2,
      '2026-11-23', 'B', t, 188161, 99, 24, 706, 215,
    ]);
  });
});

describe('runJobs', () => {
  it('isolates failures and logs every job', async () => {
    const sql = fakeSql();
    const results = await runJobs(
      sql,
      {
        good: async () => 3,
        bad: async () => {
          throw new Error('boom');
        },
      },
      5000,
    );
    expect(results.map((r) => [r.job, r.ok, r.rows, r.error])).toEqual([
      ['good', true, 3, undefined],
      ['bad', false, 0, 'boom'],
    ]);
    const log = sql.calls.at(-1)!;
    expect(log.query).toMatch(/^INSERT INTO collector_runs/);
    expect(log.params.filter((_, i) => i % 6 !== 4)).toEqual(['good', 5000, 1, 3, null, 'bad', 5000, 0, 0, 'boom']);
  });
});
