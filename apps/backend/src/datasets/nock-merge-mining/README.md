# Nock merge mining

Daily snapshots of Nockchain ↔ Pearl merge mining: how many Pearl blocks carry a Nock tag and pair with a Nock block, and declared vs landed blocks per Nock miner address.

## Source

- **API:** https://nockscan.com/api/v1/merge-mining (no key). Each response covers a rolling 24h and 7d window as of `tipHeight`.
- **Live collection:** the `nock:merge-mining` job in `src/collect/nock.ts` runs at 14:00 UTC each day (worker cron `0 14 * * *`) and writes to D1. Run it by hand with `bun run collect:once daily`.
- **Not stored:** `recentPairs`, `aiActivationHeight`, `firstDeclaredHeight` and the explorer links.

## Files

`summary.csv` (22 rows) and `miners.csv` (137 rows) are the snapshots from 2026-11-02 to 2026-11-23, collected before the job existed. `bun src/datasets/nock-merge-mining/seed.ts` (run from `apps/backend` with secrets loaded) loads them into D1. It is idempotent: each day upserts.

## Tables

| Table | Key | One row per |
|---|---|---|
| `nock_merge_mining` | `day` | UTC day: tip height, h24/d7 Pearl windows, declared and window2016 AI shares, cumulative Pearl totals, miner count |
| `nock_merge_miners` | `day, address` | miner per UTC day: declared and landed blocks over 24h and 7d |

`t` is the fetch time in unix ms. A same-day rerun overwrites that day's rows.
