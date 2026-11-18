# Oasis Index 2026

`oasis-index-2026.json`: what 5 domestic beers (0.5 l each) plus 2 packs of cigarettes cost in 69 cities, converted to US dollars.

## Source

- **Primary source:** Deutsche Bank Research Institute, *Mapping the World's Prices 2026* (10th edition, July 2026), Figure 42. https://www.dbresearch.com
- **Transcribed from:** Mapular, "The Oasis Index: What 5 Beers and 2 Packs of Cigarettes Cost in 69 Cities" (16 July 2026). https://mapular.com/blog/oasis-index-2026
- **Underlying data:** mostly crowdsourced from Numbeo and cleaned by the report's authors. They warn that the data is noisy and better read for broad trends than for single numbers.
- **License:** Deutsche Bank invites readers to quote the report with attribution. Credit "Deutsche Bank Research Institute, Mapping the World's Prices 2026".
- **API:** none. The data was transcribed by hand from the article's table.

## Fields

`rank` (1 = most expensive), `city`, `country`, `priceUsd`, `pctOfNewYork` (New York = 100), `change2016To2026Pct` (`null` for Riyadh and Doha, which are new to the index).

## Notes

- **Checks run on the transcription:** 69 ranks in order, prices that never rise down the ranking, `pctOfNewYork` that matches `priceUsd / 54.10` to within 1 point, and the article's top 10, bottom 10 and biggest risers and fallers.
- **Not included:** the 2012, 2016, 2019 and 2025 prices shown on Mapular's interactive globe. The article prints only 2026 prices and the change since 2016.
