---
name: monte-carlo
description: Design, build, run and report Monte Carlo simulations, mainly for trading and investing. Covers choosing the model (parametric, i.i.d. bootstrap, block bootstrap, trade reshuffling), seeded RNG, path simulation, path-dependent metrics (max drawdown, risk of ruin, time to recover), position-sizing and Kelly sims, convergence and standard error, validating against analytic cases, and reporting percentiles. Use when the user asks for a Monte Carlo, a simulation of returns, equity curves or outcomes, a confidence interval on a backtest metric, drawdown or ruin odds, or "what's the distribution of" an uncertain result.
---

# Monte Carlo simulations

A Monte Carlo replaces one answer with a distribution: draw many random scenarios from a model, compute the metric on each, and read off the spread. The result is only as good as the **model of randomness**. Most of the work is choosing and checking that model; the loop itself is easy.

## Workflow

1. **State the question as a metric and a decision.** "What is the 5th-percentile max drawdown over 1 year at 2x leverage, and is it above my 30% limit?" Not "simulate the strategy".
2. **Choose the generating model** (table below), and write down what it assumes.
3. **Build the simulator** with a seeded RNG and a pure function `simulateOnePath(rand) → metrics`.
4. **Validate it** against a case with a known answer before trusting it.
5. **Run enough paths** for the precision you need, and check convergence.
6. **Report the distribution** with the assumptions and the sensitivity to them.

## Choosing the model

| Model | How | Keeps | Loses | Use when |
|---|---|---|---|---|
| **Parametric (normal / GBM)** | Draw returns from N(μ, σ) or log-normal | Nothing beyond μ, σ | Fat tails, skew, autocorrelation, volatility clustering | Quick intuition, teaching, option pricing under its own assumptions. Understates crashes. |
| **Parametric, fat-tailed** | Student-t (ν ≈ 3–5, scaled to σ), or a regime/GARCH model | Fat tails (and clustering, with GARCH) | Whatever the model doesn't specify | You need tails and have too little data to bootstrap |
| **i.i.d. bootstrap** | Resample historical returns with replacement | The empirical distribution, fat tails and skew | Order: autocorrelation, volatility clustering, trends | Returns are roughly independent (e.g. per-trade P&L of a non-overlapping strategy) |
| **Block / stationary bootstrap** | Resample contiguous blocks (fixed length, or random geometric lengths, mean ≈ √T or tuned) | Short-range dependence and clustering inside blocks | Dependence longer than a block; regimes not in the sample | Daily returns, equity curves, anything path-dependent. **The default for time series.** |
| **Trade reshuffle** | Permute (or resample) the backtest's trade list | Every trade's P&L | Their real order | Asking "how much of my drawdown was luck of the order?" |
| **Scenario/regime mix** | Draw a regime per period (bull/bear/crash) from chosen probabilities, then returns within it | Your explicit beliefs | Objectivity | Stress-testing views; pairs with **probabilistic-thinking** |

Rules of thumb:

- **Bootstrapping can't invent events that aren't in the sample.** With two years of bull-market data, the sim has no crash. Add stress scenarios, or blend in a fat-tailed model, and say so.
- **Simulate in log returns or multiply growth factors** (`equity *= 1 + r`). Never add simple returns across periods.
- **Keep cross-asset correlation.** For a portfolio, resample whole dates (rows) across all assets, never each asset independently. For parametric models, use a covariance (Cholesky) draw.
- **Model costs and constraints inside the path:** fees, slippage, funding, rebalancing, stops, margin calls, liquidation. Path-dependent rules are why you simulate paths rather than use a formula.

## Implementation

```ts
// Shape, not a library: pure, seeded, one path per call.
type Metrics = { finalReturn: number; maxDrawdown: number; ruined: boolean };

function simulateOnePath(
  rand: () => number,
  returns: readonly number[],
  horizon: number,
  ruinLevel = 0.5, // equity multiple that counts as ruin
): Metrics {
  let equity = 1, peak = 1, maxDd = 0, ruined = false;
  for (let t = 0; t < horizon && !ruined; t++) {
    const r = returns[Math.floor(rand() * returns.length)]!; // swap in block sampling for time series
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, 1 - equity / peak);
    ruined = equity <= ruinLevel;
  }
  return { finalReturn: equity - 1, maxDrawdown: maxDd, ruined };
}
```

- **Seed the RNG** and record the seed with the results, so any run can be reproduced. Never use `Math.random()` in a simulation whose result you report.
- **One RNG stream per run.** For parallel workers, give each its own seed derived from the base seed (`seed + workerId`), never a shared stream.
- **Keep the simulator pure:** inputs + RNG → metrics. Aggregation happens outside it.
- **Store per-path metrics, not full paths**, unless you need fan charts. For a fan chart, keep percentiles per time step.
- **Python:** vectorize with NumPy (`rng = np.random.default_rng(seed)`, draw an `(n_paths, horizon)` index array, `np.cumprod`). Loops over paths in pure Python are slow past ~10⁴ paths.

### In this repo

`apps/backend/src/trading/strategies/engine/walkforward/` already has:

- `seededRandom(seed)` and `sampleWithoutReplacement` in `internal.ts`. Reuse them rather than adding another PRNG.
- `bootstrapSharpeCi` in `statistics/aggregation.ts`, a stationary bootstrap (restart probability 1/√T) giving a 5–95% Sharpe interval. Follow its pattern for new bootstrap metrics.

## Metrics worth simulating

| Metric | Notes |
|---|---|
| Final return / CAGR distribution | Report median, not mean: compounding makes the mean misleading (a few huge paths drag it up) |
| Max drawdown distribution | Path-dependent; the backtest's single max DD is one draw from this |
| Probability of ruin | P(equity ever ≤ ruin level) within the horizon. Define the ruin level explicitly (e.g. −50%, margin call) |
| Probability of hitting a target | P(equity ≥ target by horizon) |
| Time under water / time to recover | Longest stretch below the previous peak |
| Confidence interval on a backtest stat | Sharpe, win rate, profit factor via bootstrap: tells you how much of the backtest is noise |

## Position sizing and Kelly sims

Simulate the same return stream at several sizes (e.g. 0.25x, 0.5x, 1x, 2x Kelly, or leverage 1–5x) with the **same seeds**, so differences come from size, not luck (common random numbers). Plot median growth and ruin probability against size. Full Kelly maximizes median growth in theory but with deep drawdowns, and over-betting past it lowers growth and raises ruin. Estimation error in `p` and the payoffs makes the real optimum smaller, which is why half Kelly is common. For a single bet's Kelly fraction, use **bet-sizing**; use this skill to see what that size does over many bets.

## Precision and convergence

- The standard error of a mean estimate is `σ / √N`. To halve the error you need 4x the paths.
- For a probability `p`, the standard error is `√(p(1−p)/N)`, so `N ≈ p(1−p)/SE²`. A 1% ruin probability to ±0.2% needs 0.0099 / 0.000004 ≈ **2,500** paths. Rarer events need many more.
- Tail percentiles (1st, 99th) converge slowly. Use 10⁴–10⁵ paths for them.
- **Check convergence:** rerun with 2x the paths and a different seed. If the reported numbers move by more than your stated precision, run more.
- Report the Monte Carlo error alongside the number: "P(ruin) = 3.1% ± 0.2%".
- **Variance reduction**, when runs are expensive: antithetic draws (use `u` and `1−u`) and common random numbers when comparing variants.

## Validation

Before trusting any sim, check it reproduces something known:

- GBM with μ, σ: the simulated mean of log terminal wealth ≈ (μ − σ²/2)·T, and its std ≈ σ·√T.
- A fair coin-flip bet at size f: the simulated median growth rate matches `0.5·ln(1+f) + 0.5·ln(1−f)`.
- An i.i.d. bootstrap of the backtest's own returns, at the backtest's horizon: the mean of the simulated log final wealth should match the backtest's total log return (Σ ln(1 + r)).
- Zero volatility gives the deterministic answer; zero edge gives median growth ≤ 0.

If a check fails, the bug is in the simulator. Don't tune the inputs until it passes.

## Pitfalls

- **Overfitting survives resampling.** Bootstrapping an overfit backtest's returns gives a confident distribution around a fake edge. Use out-of-sample or walk-forward returns as the input, and treat the backtest edge as an upper bound. (See **strategy-reviewer** for look-ahead and overfitting checks.)
- **Too-short samples:** 50 trades can't support a 1st-percentile estimate. Say how many independent observations the input contains.
- **Ignoring parameter uncertainty:** μ and σ are estimates. For a fuller picture, resample them too (draw μ from its sampling distribution per path).
- **Mean of compounded outcomes:** report median and percentiles, never only the mean.
- **Independent assets resampled separately** destroy correlation and understate portfolio drawdowns.
- **Precision theatre:** 4 decimals on a number whose MC error is ±2% or whose model assumption could move it 10%.

## Output

1. The question as a metric, and the decision threshold if any.
2. The model and its assumptions in one or two lines (e.g. "stationary bootstrap of 730 daily returns, mean block 27 days, 10,000 paths, seed 42, 10 bps per trade").
3. A results table: median, 5th and 95th percentiles (1st/99th when tails matter) for each metric, plus probabilities (ruin, target) with their MC standard error.
4. Sensitivity: how the key result moves under one or two changes to the assumptions (a fat-tailed model, a stress regime, half the edge).
5. The validation check that was run, and its result.
6. The code (seeded and reproducible) when the user will rerun it, or a chart (fan chart or histogram) when they're deciding.
