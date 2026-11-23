# Datasets

Each dataset has its own folder holding the JSON, a README that cites the source, and, when the source has an API, a `fetch.ts` that downloads it again.

| Folder | What it is | Source | Refresh |
|---|---|---|---|
| [oasis-index/](oasis-index/) | Oasis Index 2026: what 5 beers and 2 packs of cigarettes cost in 69 cities, in USD | Deutsche Bank Research Institute, via Mapular | None, transcribed by hand |
| [bezos-1000/](bezos-1000/) | 496 entrepreneurs and hired CEOs ranked by wealth created for others | bezos1000.com | `bun src/datasets/bezos-1000/fetch.ts` |
| [big-mac-index/](big-mac-index/) | The Economist's Big Mac index: input survey data (1986–2026) and the computed raw and GDP-adjusted index (2000–2026) | The Economist, github.com/TheEconomist/big-mac-data | `bun src/datasets/big-mac-index/fetch.ts` |
| [rolex-market-index/](rolex-market-index/) | WatchCharts Rolex Market Index: the index value, 15 collection sub-indexes and the 30 constituent watches, as of 17 Nov 2026 | watchcharts.com | None, the history and API are paid; snapshot of the public page |
| [nock-merge-mining/](nock-merge-mining/) | Daily Nockchain ↔ Pearl merge-mining snapshots: Pearl tag/match windows and per-miner declared vs landed blocks | nockscan.com API | Daily `nock:merge-mining` collector into D1; `seed.ts` loads the 2026-11-02 to 2026-11-23 history |
