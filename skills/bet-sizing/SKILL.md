---
name: bet-sizing
description: Size a discretionary investment or trade with an asymmetric-Kelly formula capped by category, f = clip(p/a − (1−p)/b, 0, 1) × x. Covers top-down vs conviction sizing, Kelly and its limits, category risk caps, and a process-over-outcome review. Use when the user asks how much to put into a position, token, deal or trade, compares two bets, wants to check concentration, or asks about Kelly or position sizing.
metadata:
  source: Jason Choi (@mrjasonchoi), "How to size bets" thread, Jan 2022
---

# Bet sizing

Source: https://x.com/mrjasonchoi/status/1483482304341487622

Picking the investment is half the game; sizing it is the half that matters more. A wrong bet sized right is a lesson. Sized wrong, it can mean ruin. A right bet sized too small leaves you with nothing to show for being right.

The goal is to **maximize upside while capping the downside at a tolerable level**. "Tolerable" depends on the user. A fund whose investors redeem after a 20% down month has a different limit from a prop trader who can absorb 20% down days.

## Three ways to size

| Approach | Rule | Common in |
|---|---|---|
| **Top-down (risk)** | Every bet is limited to x% of the book, or every check is the same size | Angels, spray-and-pray funds, accelerators |
| **Bottom-up (upside)** | Bet only if this one position can return the fund; size by conviction | Concentrated funds that are disciplined on fund size and valuation |
| **EV (Kelly)** | Bet the fraction that maximizes long-run growth | Poker; VC, where going to zero is a real outcome |

Classic Kelly is `f = p − (1−p)/b`, where `b` is the odds (2-to-1 means b = 2). It assumes a loss takes the whole stake. In public markets, where positions rarely go to zero, that assumption breaks. Classic Kelly treats "+200% / −50%" the same as "+400% / −10%", even though the second is far better.

## The formula

```
kelly = p / a − (1 − p) / b
size  = clip(kelly, 0, 1) × x
```

| Symbol | Meaning |
|---|---|
| `p` | Probability the bet works |
| `a` | Fraction lost if it fails (0.5 = −50%; 1 = goes to zero) |
| `b` | Fraction gained if it works (2 = +200%) |
| `x` | Top-down cap for this category of bet, as a fraction of the bankroll |

The `p/a` term rewards asymmetry: a small `a` (limited downside) drives the size up fast. The cap `x` keeps any single idea from taking over the book. Clip the Kelly result to [0, 1] first, so `x` is a hard ceiling.

- **Kelly ≤ 0 means no bet**, however good the story sounds.
- **Kelly ≥ 1** means the inputs say "everything", so the bet sits at its cap. Check whether `p` or `a` is too optimistic.

### Default category caps (the user can override them)

| Category | `x` |
|---|---|
| Core holding | 50% |
| Catalyst / event play | 25% |
| Venture-stage / early token | 10% |

### Worked examples

| Bet | p | a | b | Kelly | Category | Size |
|---|---|---|---|---|---|---|
| Catalyst, +200% / −50% | 0.60 | 0.50 | 2.0 | 1.20 − 0.20 = 1.00 | catalyst (25%) | **25%** |
| Core, +50% / −50% | 0.55 | 0.50 | 0.50 | 1.10 − 0.90 = 0.20 | core (50%) | **10%** |
| Venture, 10x or zero | 0.30 | 1.00 | 9.0 | 0.30 − 0.078 = 0.22 | venture (10%) | **2.2%** |
| Coin flip, +50% / −50%, p = 0.40 | 0.40 | 0.50 | 0.50 | 0.80 − 1.20 = −0.40 | any | **0, no bet** |

A 10x return is a **gain** of 9x, so `b = 9`, not 10.

## Workflow

1. **Get the inputs.** Ask for `p`, the downside `a`, the upside `b`, and the category. Push for a concrete scenario behind each number ("what has to happen for −50%?"). If the user can't state a downside, the bet isn't ready to size.
2. **Pressure-test `p`.** People overestimate their own `p`. Ask for a base rate or a track record in similar bets. When `p` is a gut call, also show the size at `p − 0.10`.
3. **Compute and show the arithmetic**, in a table like the one above.
4. **Check the portfolio.** The thread doesn't cover this step, so flag it as your own addition:
   - Total exposure per category against its cap.
   - Correlation between positions. Most crypto moves together, so five 10% alt positions behave like one 50% bet.
   - The worst case if every open position hits its `a` at once, compared with the user's tolerable drawdown.
5. **Recommend a size** as a percentage and in dollars if the bankroll is known. Use fractional Kelly (half Kelly inside the cap) when the inputs are soft. Say which you chose and why.

The formula is a guide for a decision the user still makes, not an autopilot. Its value is that it makes sizing systematic and the asymmetry visible.

## Concentration and process

- The best investors in history have made large, concentrated bets when they found real asymmetry, maybe once a year or once in a career. Survivorship bias hides the ones who did the same thing and blew up.
- **A good outcome doesn't prove a good process.** A friend who went all in on one token and made millions has proved nothing. Only performance over time counts.
- When reviewing a past bet, judge the inputs (`p`, `a`, `b`, `x`) at the time of the decision, not the result. Ask whether the size was right given what was known then.

## Output

Show the inputs, the Kelly arithmetic, the cap applied, and the final size as a percentage and in dollars. Then list the portfolio-level flags. End with the one input that would change the answer most if it were wrong. This is a framework to support the user's decision, not financial advice. Say so once if the user is sizing real money, and not on every reply.
