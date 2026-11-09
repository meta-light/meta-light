# Style Guide

House style for research reports, newsletters and X posts. The x-posts skill points here too, so keep this the single source for voice, terminology and number formatting.

For removing AI writing patterns, run the stop-slop skill on the final draft. The checklist at the bottom of this file covers the research-specific cases stop-slop doesn't.

## Voice

- Write like an investor, not a reporter. Have a view and back it with numbers.
- Confident and specific. Opinions are fine when they're anchored to data: "Revenue grew 63% QoQ to ~$14.1M, the strongest quarter since launch."
- Narrow emotional range. Conviction comes from data density, not adjectives.
- Use the institutional "we" for views and judgments ("we think", "we view"). Use third person for mechanics ("The protocol routes orders through...").
- Active voice. Name who did what.
- Attribute sources inline: "Per the team's Q3 update...", "Speaking to several funds, we heard...".
- Reference your own prior work when relevant, and say so plainly when a past call was wrong. It builds trust.
- No throat clearing. Start with the point.
- No humor except in a punchy title.

### Conviction ladder

Match the wording to the strength of the evidence. Don't jump to the top without building the case.

1. "this is a risk to monitor"
2. "we'll revisit" / "we'll reassess if..."
3. "we think" / "we believe"
4. "we see" / "we view"
5. "we are constructive on"
6. "we are overweight" / "we remain overweight"
7. "we support an overweight position"

Pair every conviction statement with a time horizon, a condition, or a risk. "That said" is the standard pivot into the counterpoint.

### Sentences

- Dense but readable. Most analytical sentences run 20 to 35 words. Flag anything over 40.
- Mix in two or three short, blunt sentences per piece for emphasis. "The market disagrees." "That number is not a typo."
- Paragraphs of two to four sentences. Flag anything over six.
- Useful sentence shapes:
  - Assertion + evidence: "Retention is the strongest signal: 51% of March depositors remain after seven months."
  - Condition + implication: "If funding stays negative through Q2, yield on the vault falls below Treasurys."
  - Comparison + interpretation: "At 12x P/S versus a peer median of 25x, the market is pricing in a fee cut."
  - "Rather than": "The growth came from existing users depositing more, rather than new users."
- Front-load the condition when there is one: "Assuming the fee switch passes, ...".

### Punctuation

- Never use em dashes or en dashes. Use commas, colons, parentheses or a new sentence instead.
- Colons introduce an explanation or a number.
- Parentheses hold supporting data: "(up ~50% MoM)".
- Semicolons are fine for joining two related claims.
- No bold or italics for emphasis in body text.
- No exclamation marks.

### Metaphors and analogies

Keep metaphors financial and concrete: flywheel, moat, call option, tailwind, cold start, wedge. Analogies map a crypto mechanism to a traditional finance one in a single sentence ("Think of it as a money market fund whose NAV updates every block"). Skip anything grander than that.

## Vocabulary

Use precise analyst vocabulary: take rate, unit economics, FDV, P/S, comps, moat, flywheel, cold start, execution risk, tail risk, binding constraint, key signposts, "as of writing", TTM, MoM, QoQ, YoY.

Avoid:

- Hype: revolutionary, game-changing, massive, exciting, groundbreaking, LFG, no-brainer, 100x, moon, WAGMI.
- "bullish" or "bearish" as standalone verdicts. Say what you think and why.
- Intensifiers: very, really, extremely, incredibly.
- Vague quantities: a lot of, many, some, several, significant. Give the number.
- Report narration: "In this report we will...", "Let's take a look at...", "In this issue...".
- Filler words: delve, crucial, landscape, paradigm, leverage (as a verb), utilize, in order to, robust, seamless, unlock (as a verb for value).

Swap hype words for precise ones:

| Avoid | Use |
| --- | --- |
| moon, WAGMI | appreciation, conviction |
| guaranteed, safe | projected, hedged |
| profits | net revenue |
| passive income | yield |
| bet | thesis, position |
| huge growth | the actual figure plus a base |

### Jargon

Don't define standard terms for a crypto-native reader: TVL, FDV, P/S, APY, LST, AMM, MEV, CLOB, DEX, L1, L2, DeFi, RWA. Do define a novel mechanism in one sentence the first time it appears. Spell out EVM, SEC, CFTC and DOJ on first use.

## Terminology

- onchain, offchain (one word, no hyphen)
- L1, L2, DeFi, DePIN, RWAs, NFTs, DAOs
- US, UK, EU (no periods)
- hard fork, dapp, multichain, startup, sell-off, hash rate, white paper, indexes (not indices), the Merge
- proof-of-work, proof-of-stake (hyphenated)
- crypto asset (two words)
- adviser, not advisor
- "an NFT"
- "traditional finance" and "centralized finance" spelled out, not TradFi or CeFi
- Treasurys (US government debt)
- Tickers without a dollar sign: ETH, SOL, not $ETH
- No spaces around a slash: P/S, BTC/USD
- "capital", not "cash", when talking about stablecoin balances

## Numbers

- Compact units: $100M, $2B, $10K, 1MB, 2GB.
- One decimal place by default, two at most: $1.4B, 3.25%.
- Spell out one through nine in prose; numerals for 10 and up, and always numerals with units ($5M, 3x, 7%).
- Leading zero on decimals: 0.1, not .1.
- Ranges use "to" in prose ("$2B to $3B"). Dates can use a hyphen in tables.
- Use ~ for approximations: ~$5B.
- Spell out currencies other than USD on first use.
- Never give a big percentage without its base. "Revenue grew 150% from $2M to $5M" is honest. "Revenue grew 150%" alone is not.
- Frame metrics relative to something: a peer, a prior period, a benchmark. "10x P/S, a 50% discount to the peer median" beats "10x P/S".
- State the as-of date for any market data that moves.

## Sourcing

- Prefer primary data (onchain sources, filings, protocol dashboards) over aggregators. Note when you used an aggregator.
- Link sources inline with descriptive anchor text, never "here" or "this link".
- If a number needs data you don't have, leave a bold placeholder like **[NOTE: need 90d fee data from X]** rather than guessing. Never invent a figure.
- Team projections are claims, not data. Label them and discount them.

## Final pass checklist

Run this, then run stop-slop.

1. No em or en dashes anywhere.
2. No "not X but Y" or "it's not just X, it's Y" constructions.
3. No rhetorical questions.
4. No pseudo-profound lines ("a testament to", "speaks volumes", "the future is being written").
5. Hedges only where the uncertainty is real. Cut "arguably", "perhaps", "kind of", "somewhat" when they're just softening.
6. No formulaic transitions ("Moreover", "Furthermore", "That being said", "In addition") stacked at paragraph starts.
7. No closing recap that repeats what the reader just read.
8. Every number has a base, a comparison or a date.
9. Terminology and number formatting match the lists above.
10. Read it aloud. Anything you'd stumble over, rewrite.
