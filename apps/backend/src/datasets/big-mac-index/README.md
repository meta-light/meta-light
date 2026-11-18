# Big Mac index

The Economist's Big Mac index: Big Mac prices around the world, and how far each currency is over- or undervalued against the dollar (and the euro, pound, yen and yuan) by burger purchasing-power parity.

## Source

- **Publisher:** The Economist. Repo: https://github.com/TheEconomist/big-mac-data. Interactive: https://www.economist.com/big-mac-index
- **License:** MIT (as stated in the repo). Credit The Economist.
- **API:** none. `fetch.ts` downloads the repo's CSVs from `raw.githubusercontent.com` (branch `master`) and converts them to JSON. It doesn't clone the repo or download the R scripts or `.xls` files.
- **Refresh:** `bun src/datasets/big-mac-index/fetch.ts` (run from `apps/backend`) overwrites both files. The Economist updates the index twice a year, in January and July. Last fetched 2026-11-18, latest edition 2026-07-01.

## input.json

The raw survey data: 2,857 rows, one per country per edition, from 1986-09-01 to 2026-07-01.

| Repo file | Rows | Dates |
|---|---|---|
| `source-data/big-mac-historical-source-data.csv` | 341 | 1986–1999 |
| `source-data/big-mac-source-data-v2.csv` | 2,516 | 2000–2026 |

Fields: `date`, `name`, `iso_a3`, `currency_code`, `local_price` (Big Mac price in local currency), `dollar_ex` (local currency units per USD), `GDP_dollar` and `GDP_local` (GDP per person, used for the adjusted index; `null` before 2000).

`source-data/big-mac-source-data.csv` isn't included. It's the older version of the v2 file and has no `GDP_local`.

## output.json

The Economist's computed index, `output-data/big-mac-full-index.csv`: 2,056 rows from 2000-04-01 to 2026-07-01. This file contains all the rows and columns of `big-mac-raw-index.csv` and `big-mac-adjusted-index.csv`, so those two aren't included separately.

| Field | Meaning |
|---|---|
| `date`, `name`, `iso_a3`, `currency_code`, `local_price`, `dollar_ex` | As in input |
| `dollar_price` | `local_price / dollar_ex` |
| `USD_raw`, `EUR_raw`, `GBP_raw`, `JPY_raw`, `CNY_raw` | Raw index: how far the currency is over (+) or under (−) valued against that base currency. `-0.44` = 44% undervalued |
| `GDP_bigmac` | GDP per person used for the adjustment |
| `adj_price` | Big Mac price in USD predicted from GDP per person |
| `USD_adjusted` … `CNY_adjusted` | GDP-adjusted index: over/undervaluation after allowing for richer countries having pricier burgers. `null` in 254 rows, which have no GDP data |

## Input vs output

The output has 460 fewer rows from 2000 onward than the input, because the Economist folds the individual euro members (Germany, France, Italy, Spain and others, from 2011) into one euro-area row. One Venezuela (VEF) row is also dropped. Otherwise every output row matches an input row, and `dollar_price` equals `local_price / dollar_ex` on every row.
