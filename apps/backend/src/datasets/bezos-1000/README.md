# Bezos 1000

Entrepreneurs and hired CEOs ranked by **wealth created for others**: the value of their company held by people other than themselves, rather than their own net worth.

## Source

- **Site:** Bezos 1000, https://bezos1000.com (methodology: https://bezos1000.com/methodology). The site says it was last updated in February 2026, and that its figures come from SEC filings, Bloomberg, Forbes, Yahoo Finance and company disclosures.
- **API:** public, no key needed, no pagination (one call returns every row).
  - `GET https://bezos1000.com/api/entrepreneurs` → `entrepreneurs.json`
  - `GET https://bezos1000.com/api/stats` → `stats.json`
- **Refresh:** `bun src/datasets/bezos-1000/fetch.ts` (run from `apps/backend`) overwrites both files. Last fetched 2026-11-18.

## Methodology (from the site)

| Status | Wealth created |
|---|---|
| `active` / `private` founder | Current market cap − founder's stake |
| `departed_founder` / `exited` | Market cap at departure − stake at departure (`marketCapAtDepartureBillions`) |
| `hired_ceo` | Market cap growth during tenure − personal stake (`marketCapAtStartBillions`) |

The site counts each company only once.

## entrepreneurs.json

An array of 496 people from 374 companies. Co-founders of the same company appear as separate rows, despite the "1000" in the name. All money fields are in **billions of USD**.

| Field | Notes |
|---|---|
| `id`, `name`, `title`, `company`, `ticker`, `country`, `industry`, `headquarters`, `foundedYear`, `employeeCount` | Identity and company facts |
| `status` | `active` (344), `exited` (87), `hired_ceo` (40), `private` (14), `departed_founder` (11) |
| `marketCapBillions`, `founderStakeBillions`, `founderStakePercent`, `wealthCreatedBillions` | Current figures |
| `marketCapAtDepartureBillions` / `marketCapAtStartBillions` | Only on some departed founders and hired CEOs |
| `milestones` | `[{ year, event }]` |
| `historicalData` | `[{ year, marketCapBillions, wealthCreatedBillions }]`, spanning 1985–2026 in total; most rows cover 2020–2024 |
| `description`, `logoUrl`, `photoUrl` | Display fields. Logos point to Clearbit, photos to Wikimedia |

## stats.json

Totals across the list: `totalWealthCreated` (≈ $47.7T, which equals the sum of `wealthCreatedBillions`), `topEntrepreneur` / `topEntrepreneurWealth`, `fastestGrowing` / `fastestGrowingWealth`, and `wealthCreatedThisYear`. All values are in billions of USD.

## Caveats

- These are the site's own estimates, not audited figures. Stakes and market caps for private companies are estimates.
- The values aren't rounded (e.g. `47743.74499999998`). Round them when you display them.
