---
name: dune-sql
description: Write, debug and optimize DuneSQL (Trino) queries for onchain analytics on Dune. Covers the query skeleton, time bucketing, joins against curated tables (dex.trades, tokens.erc20, prices), CTEs, {{parameters}}, window functions, decoding raw logs, and http_get/JSON/UNNEST. Use when the user asks for a Dune query, dashboard metric, or onchain SQL, or pastes a DuneSQL error.
metadata:
  source: Structure after @yotamha1, "Dune Cheatsheet" (Dec 2025)
---

# DuneSQL

Source: https://web3alert.substack.com/p/dune-cheatsheet

DuneSQL is Dune's fork of Trino. Write Trino SQL, plus the Dune extensions shown below. Table and column names change over time. When you are unsure of a table or column, say which one you assumed and tell the user to confirm it in Dune's data explorer. Never present a guessed column name as fact.

## Query skeleton

```sql
SELECT    -- columns to return
FROM      -- source table
WHERE     -- row filter (put the time filter here, always)
GROUP BY  -- buckets for aggregates (GROUP BY 1, 2 is fine)
HAVING    -- filter on buckets
ORDER BY  -- sort
LIMIT     -- cap output
```

## Dune-specific rules (the usual source of errors)

- **Addresses and hashes are `varbinary`.** Write them as unquoted literals: `WHERE "to" = 0xd8da6bf26964af9d7eed9e03e53415d37aa96045`. A quoted `'0x...'` is a varchar and won't match. To convert, use `to_hex(x)`, `from_hex('...')`, or `cast(x AS varchar)`.
- **Reserved names need double quotes:** `"from"`, `"to"`, `"value"`, `"day"`.
- **Big integers are `uint256` / `int256`.** Cast to `double` before dividing: `cast(value AS double) / power(10, decimals)`.
- **Interval literals quote the number:** `INTERVAL '7' DAY`, not `INTERVAL 7 DAY`.
- **String literals use single quotes.** Double quotes are only for identifiers.
- **Arrays are 1-indexed.** Use `element_at(arr, 1)`, which returns NULL when out of range, or `arr[1]`, which errors.
- **Reuse saved queries** by selecting from `query_<id>`, e.g. `SELECT * FROM query_1234567`.

## Core tables (EVM)

| Need | Table | Key columns |
|---|---|---|
| Raw txs | `<chain>.transactions` | `block_time`, `block_date`, `hash`, `"from"`, `"to"`, `value`, `gas_used` |
| Raw events | `<chain>.logs` | `contract_address`, `topic0..topic3`, `data`, `tx_hash`, `block_time` |
| Token metadata | `tokens.erc20` | `blockchain`, `contract_address`, `symbol`, `decimals` |
| Token transfers | `tokens.transfers` | `blockchain`, `contract_address`, `"from"`, `"to"`, `amount`, `amount_usd`, `block_time` |
| Prices | `prices.usd` (also `prices.hour`, `prices.day`) | `blockchain`, `contract_address`, `minute`, `price`, `symbol` |
| DEX swaps | `dex.trades` | `blockchain`, `project`, `block_time`, `token_bought_symbol`, `token_sold_symbol`, `amount_usd`, `taker`, `tx_hash` |
| NFT trades | `nft.trades` | `blockchain`, `project`, `block_time`, `amount_usd`, `buyer`, `seller` |
| Decoded events | `<project>_<chain>.<Contract>_evt_<Event>` | event params + `contract_address`, `evt_block_time`, `evt_tx_hash` |
| Decoded calls | `<project>_<chain>.<Contract>_call_<fn>` | call params + `call_success`, `call_block_time` |

`<chain>` is `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bnb`, and so on. Solana uses different tables: `solana.transactions`, `tokens_solana.transfers`, and `dex_solana.trades`.

Prefer curated tables (spells) like `dex.trades` over rebuilding the same data from raw logs. Use raw tables only when no curated or decoded table covers what you need.

## Time

- Bucket timestamps with `date_trunc('day', block_time)`. Other units are `'hour'`, `'week'` and `'month'`.
- Filter on the partition column, `block_time` or `block_date`, so Dune can skip partitions. Decoded tables use `evt_block_time` and `call_block_time` instead.

```sql
WHERE block_time >= now() - INTERVAL '30' DAY
WHERE block_time >= TIMESTAMP '2025-01-01' AND block_time < TIMESTAMP '2025-02-01'
WHERE block_date = current_date - INTERVAL '1' DAY
```

## Joins

```sql
-- USD value of ERC20 transfers: token decimals + minute price
SELECT
  date_trunc('day', t.evt_block_time) AS day,
  sum(cast(t.value AS double) / power(10, tk.decimals) * p.price) AS volume_usd
FROM erc20_ethereum.evt_Transfer t
JOIN tokens.erc20 tk
  ON tk.blockchain = 'ethereum' AND tk.contract_address = t.contract_address
LEFT JOIN prices.usd p
  ON p.blockchain = 'ethereum'
 AND p.contract_address = t.contract_address
 AND p.minute = date_trunc('minute', t.evt_block_time)
 AND p.minute >= now() - INTERVAL '7' DAY
WHERE t.contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48  -- USDC
  AND t.evt_block_time >= now() - INTERVAL '7' DAY
GROUP BY 1
ORDER BY 1
```

- Every join to `prices` or `tokens` needs **`blockchain` plus `contract_address`**. Without `blockchain`, an address that exists on several chains matches several rows and inflates the totals.
- Filter both sides of a join by time. On a `LEFT JOIN`, put the right side's filter in `ON`. In `WHERE`, it silently turns the join into an inner join.
- Use `LEFT JOIN` to keep every base row, `INNER JOIN` to keep only matches, and `USING (col)` when both sides share a column name.

## CTEs

Break the logic into named steps and keep the final `SELECT` simple. Aggregate inside a CTE before joining so the join runs on fewer rows.

```sql
WITH swaps AS (
  SELECT date_trunc('day', block_time) AS day, project, sum(amount_usd) AS volume
  FROM dex.trades
  WHERE blockchain = 'ethereum' AND block_time >= now() - INTERVAL '90' DAY
  GROUP BY 1, 2
),
ranked AS (
  SELECT *, rank() OVER (PARTITION BY day ORDER BY volume DESC) AS rk
  FROM swaps
)
SELECT day, project, volume FROM ranked WHERE rk <= 5 ORDER BY day, rk
```

## Parameters

Use `{{name}}` in the query text. Dune substitutes it as raw text, so the quoting goes in the query.

| Type | Usage |
|---|---|
| Text | `WHERE symbol = '{{token_symbol}}'` |
| Number | `LIMIT {{top_n}}` |
| Date | `WHERE block_time >= TIMESTAMP '{{start_date}}'` |
| List | `WHERE blockchain = '{{chain}}'` (single-select dropdown) |
| Address | `WHERE "to" = {{wallet}}` (default value an unquoted `0x...`), or `from_hex('{{wallet}}')` |

Parameters also work in chart titles and in `query_<id>` references. Always give every parameter a sensible default.

## Window functions

These keep every row while comparing each one to the others in its group.

```sql
sum(volume) OVER (ORDER BY day)                                          -- running total
avg(volume) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) -- 7d rolling avg
lag(volume) OVER (PARTITION BY project ORDER BY day)                     -- previous period
row_number() OVER (PARTITION BY wallet ORDER BY block_time)              -- first action per wallet (= 1)
volume / sum(volume) OVER (PARTITION BY day)                             -- share of day
```

## Decoding blockchain events

Try these in order:

1. **A decoded table.** Search the data explorer for the project or contract name.
2. **Raw logs.** Filter on `contract_address` and `topic0`, which is the keccak hash of the event signature, then slice the fields out of `topic1..3` and `data`. Each field is 32 bytes. An address takes the last 20 bytes of its slot.
3. **A decoding request.** Submit the contract address and ABI on Dune (dune.com/contracts/new). The decoded tables appear after Dune processes the request.

```sql
-- ERC20 Transfer(address indexed from, address indexed to, uint256 value)
SELECT
  block_time,
  varbinary_substring(topic1, 13, 20) AS "from",
  varbinary_substring(topic2, 13, 20) AS "to",
  varbinary_to_uint256(varbinary_substring(data, 1, 32)) AS value
FROM ethereum.logs
WHERE contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  AND topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  AND block_time >= now() - INTERVAL '1' DAY
```

## APIs, JSON and arrays

```sql
-- external API
SELECT json_extract_scalar(json_parse(http_get('https://api.example.com/x')), '$.data.price') AS price

-- JSON columns
json_extract_scalar(col, '$.a.b')     -- scalar as varchar
json_extract(col, '$.items')          -- JSON fragment
cast(json_extract(col, '$.items') AS array(varchar))

-- arrays to rows
SELECT t.tx_hash, a.addr
FROM some_table t
CROSS JOIN UNNEST(t.addresses) AS a(addr)
```

`http_get` is rate-limited and slow. Use it to fetch a small reference value, never one call per row.

## Functions you'll reach for

- `count(*)`, `count(DISTINCT x)`, `approx_distinct(x)` (much cheaper on large data)
- `sum`, `avg`, `min`, `max`, `approx_percentile(x, 0.5)`
- `round(x, 2)`, `coalesce(x, 0)`, `nullif(x, 0)` to guard against division by zero
- `lower`, `upper`, `concat`, `substr`, `regexp_like`
- `CASE WHEN amount_usd >= 1e6 THEN 'whale' WHEN amount_usd >= 1e4 THEN 'shark' ELSE 'fish' END`
- `get_href(url, text)` makes a clickable link in table visualizations

## Performance checklist

- [ ] Every big table has a time filter on its partition column
- [ ] Filter on `blockchain`, `contract_address` and `project` as early as possible
- [ ] No `SELECT *` on raw tables
- [ ] Aggregate before joining, and join on `blockchain` + `contract_address` (+ `minute` for prices)
- [ ] `approx_distinct` instead of `count(DISTINCT ...)` on very large data
- [ ] Heavy logic used by several queries goes into a saved query or materialized view, referenced as `query_<id>`

## Output

Return the full query in a `sql` block, ready to paste into Dune. After it, add one line per assumption: the table chosen, the column names, the decimals handling, and the parameter defaults. If the user pasted an error, name the cause in one sentence before the fixed query.
