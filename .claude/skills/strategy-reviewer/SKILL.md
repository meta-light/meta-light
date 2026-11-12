---
name: strategy-reviewer
description: Review a carpcap trading strategy (apps/backend/src/trading/strategies) for look-ahead bias, data handling, exposure, cost realism and weights-vs-orders mode fit before trusting its backtest. Use when writing, changing or reviewing a WeightsStrategy or OrdersStrategy, or when a backtest result looks too good.
---

# Strategy Reviewer

Check a strategy for correctness before trusting its results. Go through every
section. Verify each claim against the code, not against what the strategy's
comments say it does.

Adapted from the QuantJourney Backtester's `qj-strategy-reviewer` skill
(Apache 2.0, see `apps/backend/src/trading/strategies/NOTICE`).

## Timing and look-ahead

- Signals may only use data available at decision time. The engine lags target
  weights by one bar, so `computeSignals` and `computeWeights` must not also
  peek forward: no `shift(-1)`, no `iat(i + 1, ...)`, no centered windows, no
  `Frame.rolling` over data that includes later rows.
- Order strategies: `computeOrders(date, ...)` should only read feature rows at
  or before `rowIndex(date)`. Windows like "prior 55-day high" must end at
  `index`, not `index + 1`.
- Warm-up rows should be NaN or 0, never back-filled with later values.
- Anything fitted on the whole history (z-score means, percentile cutoffs,
  regression betas) is look-ahead unless it is rolling or expanding.

## Data handling

- Missing bars stay NaN. Don't `fillNaN(0)` a returns Frame and then treat the
  zeros as real observations (volatility, correlation and Sharpe all shrink).
- A NaN weight should drop the name, not distort the normalization of the rest.
- Check that every feature name passed to `data.getFeature` is listed in
  `config.indicators` (for example `SMA_50_close` needs SMA period 50 on close).

## Weights and exposure

- Long/cash: weights in [0, cap] and the row sum at most 1. Confirm
  `maxPositionSize` matches the cap the code actually applies.
- Long/short: check gross (sum of |w|) and net (sum of w). Market-neutral should
  have net near 0; a missing leg on some dates breaks neutrality.
- Renormalizing must not silently move positions that were meant to stay put.
- Check how `riskModel` (vol target, risk parity, position limit, chains)
  rescales the weights, and that leverage caps hold after it.

## Costs and realism

- A strategy that only works at zero cost does not work. Anything with high
  turnover (intraday, short-term reversal, daily rebalancing) needs realistic
  `slippage` and `commission`.
- Shorts: borrow fees and financing are not modeled. Ask whether the edge is
  just the missing carry, and flag it.
- FX and futures templates use price-return proxies unless they read
  `broker.contractSpec`; margin, swaps and rolls are not modeled.

## Mode fit

- If the edge depends on stop-losses, brackets or limit fills, it belongs in an
  `OrdersStrategy`, not a `WeightsStrategy`.
- Orders: a gap through a stop fills at the open, not at the stop price. Don't
  assume per-order commission minimums apply per fill. Check that
  `hasPending(inst)` guards stop duplicate orders, and that exits call
  `cancelAll(inst)` before submitting.

## Output

Report each finding as: severity, where (file:line and method), what is wrong,
and the fix. Keep correctness bugs separate from style notes.
