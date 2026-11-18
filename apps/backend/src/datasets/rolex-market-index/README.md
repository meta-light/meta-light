# WatchCharts Rolex Market Index

`rolex-market-index-2026-11.json`: a snapshot of the WatchCharts Rolex Market Index as of 17 November 2026. It holds the index value, its performance, the 15 collection sub-indexes and the 30 watches in the index.

The index tracks Rolex on the secondary (pre-owned) market. It is the average market price in USD of the brand's top 30 models, which are chosen and weighted by transaction value. It is rebalanced every 1 January.

## Source

- **Page:** WatchCharts, "WatchCharts Rolex Market Index". https://watchcharts.com/watches/brand_index/rolex
- **Methodology:** https://watchcharts.com/watches/index_methodology
- **Captured:** 18 November 2026, from the public page. The page said "Last updated November 17, 2026".
- **License:** WatchCharts data is proprietary. Cite "WatchCharts" when you quote it. Publishing it in an app or on a website requires their distribution license (https://watchcharts.com/api/license).
- **API:** none here. The index history (the chart) and the CSV downloads need a WatchCharts Professional subscription. The official API (https://watchcharts.com/api) needs a paid key: $199 a month, or $99 a month billed annually. To refresh the snapshot, save the page again and rebuild the JSON.

## Fields

- **`index`:**
  - `valueUsd`
  - `numberOfWatches`
  - `oneYearRangeUsd` as `[low, high]`
  - `performance`: for each period (1M, 3M, 6M, 1Y, 3Y, 5Y, Max), `changePct` and `aagrPct` (average annual growth rate). These are rounded to one decimal, as published.
- **`collections`:** one row per collection sub-index, sorted by index value, highest first.
  - `collection`
  - `slug`, the URL path under `/watches/brand_index/rolex/`
  - `indexValueUsd`
  - `changePct` for 1M through Max
- **`watches`:** the 30 constituents, sorted by index weight, highest first.
  - `reference`
  - `nickname`, such as Pepsi or Hulk; `null` if the watch has none
  - `collection`
  - `inProduction`
  - `marketPriceUsd`
  - `indexWeightPct`
  - `listingCount`: the number of listings WatchCharts tracks for the watch
  - `changePct` for 1M, 3M, 6M and 1Y only. The page does not give longer periods for individual watches.
  - `url`

Percentages are in percent (`4.6` means +4.6%). Collection and watch changes have two decimals and come from the page's unrounded data.

## Notes

- **Checks run:**
  - All 15 collection values match the page's table.
  - Each watch's price, 1Y change and weight match the page's table, apart from three differences of 0.1 caused by rounding twice.
  - The sum of weight × market price over the 30 watches is $27,872, the published index value.
- **Constituents change every January**, so the watch list is valid for 2026 only.
- **Not included:**
  - The index's price history, which needs a subscription.
  - Watch images.
  - The small trend-chart images.
