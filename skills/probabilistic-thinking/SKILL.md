---
name: probabilistic-thinking
description: Turn a market view into explicit scenarios with probabilities, payoffs and a pre-committed plan, instead of a single directional call. Covers enumerating possible futures, weighting them with historical base rates, picking the best trade per scenario, expected value, invalidation levels, and journaling the estimates for later review. Use when the user asks what to do with a position during a crash or pump, whether to buy, hold or sell, "what happens next" for a token or market, wants a trade plan or thesis, or wants to review a past trade.
metadata:
  source: Cobie, "Probabilistic thinking" (Substack, Dec 2021)
---

# Probabilistic thinking

Source: https://cobie.substack.com/p/probabilistic-thinking

Nobody can see the future, so don't predict one. Lay out the plausible futures, estimate how likely each one is, and choose the trade that does best across them. Trading is a probabilistic-outcomes business. A good call is a good bet on the distribution, not a correct guess.

## Workflow

### 1. Enumerate the scenarios

List 3–5 distinct futures, each one a path rather than a price: what happens, roughly when, and what the chart looks like. Include the tails, even at 5%: the crash to new lows and the instant V-recovery. Say explicitly which scenarios were left out as too unlikely (e.g. "sideways forever").

Example (ETH after falling from ~$4,400 to below $2,000 in 8 days, May 2021):

| # | Scenario |
|---|---|
| 1 | The top is in: a 2017-style boom and bust, a relief rally into a lower-high "complacency shoulder", then down |
| 2 | Cool off, then a 2013-style double bubble to new highs later in the year |
| 3 | Down only, to new lows |
| 4 | Instant recovery to new highs |

### 2. Weight them

Give each scenario a probability. The probabilities must add up to 100%. **Use history to inform the guesses** by asking it specific questions:

- Has a drawdown of more than 50% happened mid-bull-market without ending it? What was the largest mid-cycle drawdown?
- What happened after past drawdowns of 30%? Is there a concrete reason this time differs?
- How did this kind of asset (a meme coin, a heavily hyped alt) perform against BTC in past bull markets? What are conservative upper targets for the pair?
- What multiple did comparable assets reach from one cycle high to the next, at a similar market cap?
- What usually happens after a listing on a major exchange?

Experienced traders add more inputs (open interest, order flow, volume profile) but the method is the same: compare to the past, then estimate. History doesn't repeat, but it gives you base rates. State which historical comparison each probability rests on. Where it's a guess, say so; it's still a guess, and you only improve at it by recording it and checking it later.

ETH weights: p(1) = 45%, p(2) = 45%, p(3) = 5%, p(4) = 5%.

### 3. Find the best trade in each scenario

| # | Best trade | Payoff from $2,000 |
|---|---|---|
| 1 | Buy, sell into the shoulder (~$3,600) | +80% |
| 2 | Buy, hold for new highs | > +100% |
| 3 | Sell, or cut at the invalidation level ($1,600) | −20% if long |
| 4 | Buy | > +100% |

If one trade wins in most of the probability mass, that's the trade. Here buying wins in 95% of it.

### 4. Compute expected value

```
EV = Σ p(i) × payoff(i)
ETH: 0.45 × 80% + 0.50 × 100% + 0.05 × (−20%) = +85%   (a floor, since 2 and 4 are "> +100%")
```

Show the arithmetic. Also show the worst case and its probability: a positive EV with a 5% chance of a large loss can still be the wrong trade for someone who can't absorb that loss.

### 5. Commit to the plan before entering

- **Entry**, and the **re-evaluation point**, e.g. "re-evaluate near $3,600, where scenarios 1 and 2 diverge".
- **Invalidation:** the price or event that means the losing scenario is happening, and the exit, e.g. "new lows: cut at $1,600". The −20% in the EV is only real if this exit is actually taken.
- **What would change the weights:** the signals that would make you move probability between scenarios.

The same table works for someone already holding. If holding wins in most scenarios, it argues against panic-selling at the lows.

### 6. Size it

To size the position, collapse the scenarios into a win probability `p`, an average upside `b` and a downside `a` (the loss at the invalidation level), and use the **bet-sizing** skill. For the ETH example, p = 0.95, b ≈ 0.8 (conservatively, the smallest win), a = 0.2.

### 7. Journal it, then review it

Record the scenarios, the weights, what each was based on, the plan and the size **at the time of the trade**. Afterwards, review the estimates, not the outcome: were the scenarios complete, were the weights reasonable given what was known, was the plan followed? Don't blame market makers or manipulators for a bad estimate.

## Second example: an event-driven bet

DOGE at ~$0.01, with Elon Musk tweeting about it again:

| # | Scenario | p | Outcome |
|---|---|---|---|
| 1 | He keeps shilling, it goes up | 75% | up |
| 2 | He keeps shilling, it doesn't go up | 10% | down |
| 3 | He stops, it pumps anyway | 7.5% | up |
| 4 | He stops, it goes down | 7.5% | down |

Up: p = 82.5%. Down: p = 17.5%, worst case about −50% (losing the previous range floor). Cobie writes the upside as "+350% (3 to 4 cents)". **Check payoff units:** $0.01 → $0.03–0.04 is a 3–4x multiple, i.e. +200% to +300%, not +350%. Convert every target to a percentage gain from the entry before computing EV. A 10x is +900%.

With +200% as the conservative upside: EV = 0.825 × 200% − 0.175 × 50% ≈ +156%.

The 75% rests on a base rate: he had shilled it through 2019 and 2020. Scenarios 2 and 4 cover the bet failing: the shilling stops working, or someone reins him in.

## Guardrails

- **Bad estimates mean bad probabilities.** Someone who doesn't understand either the asset or price behaviour will estimate badly, and the EV is worth nothing. Call out weights that aren't backed by anything, and scenarios that are missing.
- **Prefer survival to short-term gains.** For most people, holding long-term exposure beats actively trading it away. If the user is trading on impulse, suggest less risk, longer horizons, and journaling.
- A clean table can make a guess look precise. Round the probabilities (5% steps) and treat the output as a structured guess.

## Output

1. The scenarios, with their probabilities and the base rate or reasoning behind each. Name the scenarios excluded as too unlikely.
2. The best trade in each scenario, with the payoff in percent from the entry.
3. The EV arithmetic, plus the worst case and its probability.
4. The plan: entry, re-evaluation point, invalidation and exit, and the signals that would change the weights.
5. The inputs for **bet-sizing** (`p`, `a`, `b`), if the user wants a size.
6. A journal entry they can paste.

This is a way of thinking, not financial advice. Say so once if real money is involved.
