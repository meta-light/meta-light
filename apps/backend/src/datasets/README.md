# Datasets

Each dataset has its own folder holding the JSON, a README that cites the source, and, when the source has an API, a `fetch.ts` that downloads it again.

| Folder | What it is | Source | Refresh |
|---|---|---|---|
| [oasis-index/](oasis-index/) | Oasis Index 2026: what 5 beers and 2 packs of cigarettes cost in 69 cities, in USD | Deutsche Bank Research Institute, via Mapular | None, transcribed by hand |
| [bezos-1000/](bezos-1000/) | 496 entrepreneurs and hired CEOs ranked by wealth created for others | bezos1000.com | `bun src/datasets/bezos-1000/fetch.ts` |
| [big-mac-index/](big-mac-index/) | The Economist's Big Mac index: input survey data (1986–2026) and the computed raw and GDP-adjusted index (2000–2026) | The Economist, github.com/TheEconomist/big-mac-data | `bun src/datasets/big-mac-index/fetch.ts` |
