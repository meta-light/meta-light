# Strategies

50 strategy templates ported from the QuantJourney Backtester's Python
examples: 25 weight-based, 20 order-based and 5 walk-forward / optimization.
`engine/` is a TypeScript port of the backtest engine itself: the run loop
(`Backtester`, weights and orders modes), execution and fills, risk models,
portfolio accounting and rebalancing, metrics, and the walk-forward runner.
Nothing here is wired into the bot yet.

The engine building blocks were checked against the Python engine module by
module. The run loop and walk-forward runner have not been checked end to end
against Python yet.

## Layout

- `core/frame.ts`: `Frame`, a small date x instrument matrix that stands in for
  the pandas DataFrame code (rolling windows, shift, pct change, EWM, row sums),
  plus 1-D helpers and the shared `equalWeightActive` / `crossAbove` patterns.
  Missing values are NaN and behave like pandas NaN.
- `core/types.ts`: strategy config, rebalance policy, risk models, costs, order
  types and walk-forward config, mirroring the Python API in camelCase.
- `core/strategy.ts`: `WeightsStrategy` and `OrdersStrategy` base classes, and
  the `InstrumentData` / `Broker` interfaces an engine must provide.
- `core/indicators.ts`: ATR and small order helpers.
- `weights/`, `orders/`, `walkforward/`: one file per strategy. Each exports
  its `config` and a class (walk-forward files export builders and specs).

## Contract an engine has to meet

Weights strategies: set `strategy.data`, call `computeSignals()`, assign the
result to `strategy.signals`, then call `computeWeights()` for target weights
(dates x instruments) and rebalance per `config.rebalancePolicy` and
`config.riskModel`.

Order strategies: set `strategy.data` and `strategy.broker`, then call
`computeOrders(date, bars, positions, nav)` on every bar. The strategy submits
orders through `broker.fillEngine`.

`getFeature()` must serve `adj_close`, `high`, `low` and the indicator columns
listed in `config.indicators` (e.g. SMA(50) on close is `SMA_50_close`).

## Weight-based (25)

| # | Strategy | Idea | Code | Results |
|:--|:--|:--|:--|:--|
| W01 | Daily SMA Trend | Hold each sector ETF while SMA(50) > SMA(200); daily rebalance | [source](./weights/sma-daily.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-01-sma-daily) |
| W02 | Monthly ETF Trend + Drift | SMA(50/200) trend on ETFs; month-end + 5% drift band | [source](./weights/monthly-drift-etf.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-02-monthly-drift-etf) |
| W03 | Weekly RSI Reversion | Enter RSI(14) < 35, exit RSI > 60; weekly (Fri) | [source](./weights/weekly-rsi-reversion.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-03-weekly-rsi-reversion) |
| W04 | Quarterly Dual Momentum | Rank ETFs by 12-month return, hold top 2 if positive; quarter-end | [source](./weights/quarterly-dual-momentum.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-04-quarterly-dual-momentum) |
| W05 | Monthly Inverse Volatility | Size each ETF by inverse 63-day volatility; month-end | [source](./weights/monthly-inverse-vol.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-05-monthly-inverse-vol) |
| W06 | Signal-Change Defensive Rotation | SPY > SMA(200) → risk-on ETFs, else defensive; on signal change | [source](./weights/signal-change-defensive.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-06-signal-change-defensive) |
| W07 | Intraday RSI 15m | Equal-weight basket when RSI oversold; 15-minute bars | [source](./weights/intraday-rsi-15m.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-07-intraday-rsi-15m) |
| W08 | Intraday EMA Scalp 1m | EMA(9/21) trend/cash; 1-minute bars | [source](./weights/intraday-1m-ema-scalp.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-08-intraday-1m-ema-scalp) |
| W09 | Intraday SMA Trend 1h | SMA(10/30) trend/cash; hourly bars | [source](./weights/intraday-1h-sma-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-09-intraday-1h-sma-trend) |
| W10 | Monthly + Circuit Breaker | Monthly ETF trend; flatten on a 15% drawdown + cooldown | [source](./weights/monthly-circuit-breaker.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-10-monthly-circuit-breaker) |
| W11 | Quarterly TE + Cost Gate | Momentum with tracking-error trigger and turnover budget | [source](./weights/quarterly-te-cost-gate.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-11-quarterly-te-cost-gate) |
| W12 | Daily Partial Drift | Momentum tilt; trade only names past a 10% drift band | [source](./weights/daily-partial-drift.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-12-daily-partial-drift) |
| W13 | Pairs Trading (Ratio Z-Score) | Market-neutral KO/PEP on a log-ratio z-score | [source](./weights/pairs-ratio-zscore.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-13-pairs-ratio-zscore) |
| W14 | Pairs Trading (Hedge Ratio) | Market-neutral EWA/EWC on a rolling OLS hedge-ratio spread | [source](./weights/pairs-hedge-ratio.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-14-pairs-hedge-ratio) |
| W15 | Cross-Sectional Momentum (L/S) | Long top-3 / short bottom-3 by 12-month return; monthly | [source](./weights/cross-sectional-momentum.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-15-cross-sectional-momentum) |
| W16 | Cross-Sectional Reversal (L/S) | Long losers / short winners by 1-month return; weekly | [source](./weights/cross-sectional-reversal.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-16-cross-sectional-reversal) |
| W17 | Vol-Targeted Trend | SMA trend basket scaled to a 10% volatility target | [source](./weights/vol-target-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-17-vol-target-trend) |
| W18 | Vol-Targeted Momentum | Momentum basket scaled to a 15% volatility target | [source](./weights/vol-target-momentum.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-18-vol-target-momentum) |
| W19 | Risk Parity (Multi-Asset ERC) | Equal risk contribution across a multi-asset basket | [source](./weights/risk-parity-multiasset.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-19-risk-parity-multiasset) |
| W20 | Risk Parity + Position Cap | Sector ERC chained with a 25% per-position cap | [source](./weights/risk-parity-capped.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-20-risk-parity-capped) |
| W21 | Bollinger Band Reversion | Buy below the lower band, exit at the midline | [source](./weights/bollinger-reversion.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-21-bollinger-reversion) |
| W22 | MACD Trend | Long while MACD is above its signal line | [source](./weights/macd-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-22-macd-trend) |
| W23 | FX Time-Series Momentum | Six-month trend across USD-quoted spot pairs; inverse-vol weights | [source](./weights/fx-time-series-momentum.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-23-fx-time-series-momentum) |
| W24 | FX Cross-Sectional Momentum | Long strongest / short weakest XXX/USD pair; monthly | [source](./weights/fx-cross-sectional-momentum.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-24-fx-cross-sectional-momentum) |
| W25 | Continuous Futures Trend Proxy | Diversified long/short trend on provider continuous series | [source](./weights/continuous-futures-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-weights-25-continuous-futures-trend) |

W13 to W16 are market-neutral; short borrow and financing are not modeled.
W23 to W25 are price-return proxies: no FX lots, futures multipliers,
financing, margin or controlled rolls.

## Order-based (20)

| # | Strategy | Order type | Idea | Code | Results |
|:--|:--|:--|:--|:--|:--|
| O01 | Market SMA Crossover | Market | Buy SMA(20) crossing above SMA(50), sell on reverse | [source](./orders/market-sma-cross.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-01-market-sma-cross) |
| O02 | Market RSI Reversion | Market | Buy RSI(14) < 35, sell RSI > 60 | [source](./orders/market-rsi-reversion.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-02-market-rsi-reversion) |
| O03 | Limit RSI Dip Buyer | Limit | Passive buy-limit below the close on weak RSI | [source](./orders/limit-rsi-dip.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-03-limit-rsi-dip) |
| O04 | Limit Trend Pullback | Limit | In an uptrend, wait for a 1% pullback to enter | [source](./orders/limit-trend-pullback.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-04-limit-trend-pullback) |
| O05 | Stop Breakout Entry | Stop | Buy-stop above the recent 20-day high | [source](./orders/stop-breakout-entry.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-05-stop-breakout-entry) |
| O06 | Protective Stop Loss | Market + Stop | Trend entry with a 5% protective stop | [source](./orders/stop-loss-protection.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-06-stop-loss-protection) |
| O07 | Stop-Limit Breakout | Stop-Limit | Enter breakouts but cap the maximum fill price | [source](./orders/stop-limit-breakout.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-07-stop-limit-breakout) |
| O08 | Stop-Limit Protection | Market + Stop-Limit | Trend entry, downside protected by a stop-limit sell | [source](./orders/stop-limit-protection.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-08-stop-limit-protection) |
| O09 | Trailing Stop Trend | Trailing Stop | Trend entry, 4% trailing stop manages the exit | [source](./orders/trailing-stop-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-09-trailing-stop-trend) |
| O10 | RSI + Trailing Stop | Trailing Stop | Oversold RSI entry, 5% trailing stop for risk | [source](./orders/trailing-stop-rsi.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-10-trailing-stop-rsi) |
| O11 | Trailing Stop-Limit | Trailing Stop-Limit | Trailing stop that converts to a limit on trigger | [source](./orders/trailing-stop-limit.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-11-trailing-stop-limit) |
| O12 | Bracket Trend | Bracket | Trend entry with a +6% / −3% bracket | [source](./orders/bracket-trend.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-12-bracket-trend) |
| O13 | Bracket RSI Reversion | Bracket | RSI dip with a +4% / −2% bracket | [source](./orders/bracket-rsi-reversion.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-13-bracket-rsi-reversion) |
| O14 | OCO Dip or Breakout | OCO | Competing buy-limit (dip) and buy-stop (breakout) | [source](./orders/oco-dip-or-breakout.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-14-oco-dip-or-breakout) |
| O15 | Intraday 5m Bracket Reversion | Bracket | Oversold-RSI dips with a tight +0.6% / −0.4% bracket; 5-min bars | [source](./orders/intraday-5m-bracket-reversion.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-15-intraday-5m-bracket-reversion) |
| O16 | Intraday 30m Stop Breakout | Stop | Buy-stop above the 12-bar high, fixed holding period; 30-min bars | [source](./orders/intraday-30m-stop-breakout.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-16-intraday-30m-stop-breakout) |
| O17 | Monthly Rotation (orders) | Market | Event-driven monthly momentum rotation, executed with orders | [source](./orders/monthly-rotation-orders.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-17-monthly-rotation-orders) |
| O18 | Signal-Change Rotation (orders) | Market | Trade only on SMA trend-signal flips (no calendar) | [source](./orders/signal-change-rotation-orders.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-18-signal-change-rotation-orders) |
| O19 | FX Momentum with Standard Lots | Market | Contract-aware whole-lot momentum on USD-quoted spot pairs | [source](./orders/fx-momentum-lots.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-19-fx-momentum-lots) |
| O20 | Futures Donchian Contracts | Market | Whole-contract ATR sizing on provider continuous futures | [source](./orders/futures-donchian-contracts.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-orders-20-futures-donchian-contracts) |

O19 and O20 read contract specs (`broker.contractSpec`) for lot sizes and
multipliers. Margin enforcement, FX swaps, dated futures and roll execution
are out of scope.

## Walk-forward and optimization (5)

| # | Example | Idea | Code | Results |
|:--|:--|:--|:--|:--|
| WF01 | Rolling Walk-Forward | Sliding fixed-length train/test windows with a pre-OOS purge | [source](./walkforward/rolling-walkforward.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-wf-01-rolling-walkforward) |
| WF02 | Expanding Walk-Forward | Ever-growing training window vs sliding test window | [source](./walkforward/expanding-walkforward.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-wf-02-expanding-walkforward) |
| WF03 | Anchored + Pre-OOS Purging | Fixed and percentage-based exclusions before each test window | [source](./walkforward/anchored-purge-embargo.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-wf-03-anchored-purge-embargo) |
| WF04 | Grid Search | Exhaustive SMA fast/slow tuning scored by real backtests | [source](./walkforward/grid-search-optimization.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-wf-04-grid-search-optimization) |
| WF05 | Optuna TPE + Walk-Forward | Bayesian parameter search, then out-of-sample validation | [source](./walkforward/optuna-tpe-optimization.ts) | [view](https://backtester.quantjourney.cloud/strategies/example-wf-05-optuna-tpe-optimization) |

WF01 to WF03 default to `slice_diagnostics` mode, which scores in-sample
slices of one full run. Set `QJ_WF_MODE=per_fold_refit` for true out-of-sample
runs. WF04 and WF05 export the optimizer specs and a `sharpe()` scorer; the
optimizer itself (grid search, Optuna TPE) still has to be supplied.

Results links go to the original Python runs on backtester.quantjourney.cloud.

## License

Derived from the [QuantJourney Backtester](https://github.com/QuantJourneyOrg/quantjourney-bt),
Copyright (c) 2026 QuantJourney, licensed under Apache 2.0. The code was
translated from Python to TypeScript and modified. See `LICENSE` and `NOTICE`
in this directory. Those terms apply to everything under `strategies/`.
