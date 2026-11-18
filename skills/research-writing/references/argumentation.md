# Argumentation

How to build the argument: thesis, evidence, reasoning, risk and scenarios. `style.md` covers how it sounds; this file covers whether it holds up.

## Core habits

1. **Bottom line up front.** Open with the takeaways or top idea. A reader who stops after the first section should know your view, your evidence and what to watch.
2. **Data before claim.** Lead with the number, then interpret it. Don't make a claim and promise to support it later.
3. **Competitive context.** Every metric gets a comparison: a peer, a prior period, a benchmark.
4. **The "so what" rule.** Every fact earns its place by changing something about the thesis. If it doesn't, cut it.
5. **Forward anchors.** End sections and the piece with what to watch: dates, thresholds, signposts.
6. **Calibrated conviction.** Match language to evidence (see the conviction ladder in `style.md`). Every strong claim carries a condition or risk.

## Thesis

A thesis has five parts. They don't all need to be in the first paragraph, but all should appear on the first page.

1. **Direction**: overweight, underweight, constructive, cautious, neutral.
2. **Mispricing**: what the market is getting wrong.
3. **Magnitude**: quantified upside or downside.
4. **Evidence anchor**: the primary data behind the view.
5. **Horizon and conditions**: when, and under what conditions, it plays out.

The most common failure is describing what something is without saying what the market is missing.

- Weak: "The protocol is the dominant yield-trading venue with strong network effects."
- Strong: "The token trades at ~$640M FDV after a post-expiry drawdown. Over 12 months we see ~$1.7B in our base case on fee growth the market is ignoring."

Templates by conviction:

- **High**: "We are [overweight/underweight] [asset] over [horizon], tied to [catalyst]. [Mispricing]. [Quantified target]. [Bear case floor]."
- **Moderate**: "We are constructive on [subject] as [role]. [Differentiation]. [Quantified opportunity]. [Key condition]. [What we'll monitor]."
- **Conditional**: "[Subject] offers [opportunity] only if [condition]. [Evidence for the condition]. [What must happen]."
- **Bearish**: "We are underweight [asset]. [What's genuinely good about it]. [What's wrong with the investment case]. [Gap between implied and justified value]. [What would change our view]."
- **Periodic update (no recommendation)**: "[Asset] entered [period] with [dominant dynamic], as [evidence]. [Key tension]. [What resolves it]."

## Evidence

Strongest to weakest:

1. Primary quantitative data: onchain metrics, orderbook data, your own datasets.
2. Financial metrics: revenue, margins, multiples from observable data.
3. Primary qualitative research: conversations with teams, funds, users.
4. Peer benchmarks.
5. Third-party research and forecasts.
6. Structural reasoning from the mechanism.
7. Historical analogy.

Rules:

- **Show your work.** "We think it's undervalued" is a conclusion. "$85M base-case revenue at a 20x multiple implies $1.7B FDV" is an argument.
- **Density.** Deep dives need three to five specific metrics per section. Periodic updates should have two or more data points per paragraph.
- **Absence of data is evidence.** If something can't be observed, say so and say what that means: "Workloads aren't publicly observable, so they can't be underwritten."
- **Verify team claims.** Backtests and team projections get labeled as such and discounted. Anchor on your own estimates.

## If-then chains

Chains connect evidence to conclusions through explicit steps.

- Single link: "If [observable condition], then [consequence]."
- Multi-link: "If [input A] at [rate], and [input B] at [rate], then [output]."
- Competitive: "If [competitor action], then [market shift], which [helps/hurts the subject]."
- Feedback loop: "If [negative event], then [A], which causes [B], which amplifies the original problem."
- Probability-weighted: "We assign ~[X]% to [event]. In that case, [consequence]."

Rules:

1. Name every assumption. Don't hide a conditional inside an assertion.
2. Keep chains to three or four links. Break longer ones up.
3. Flag the weakest link.
4. Flex the key input and show how the output moves.
5. Ground each link in data.

## Risk

Risk is a credibility device. Handle it in two places: weave risks that threaten core assumptions into the analysis, and put the rest in a dedicated section.

For each risk give what could go wrong (specific), how bad it would be (quantified where possible), and what partially mitigates it.

Taxonomy: execution, competitive, regulatory, tokenomics, technical, market, concentration, liquidity. Watch for correlated risks, where several fail at once under the same stress.

**Falsification.** Say what would change your view:

- Bearish regime calls: the prerequisites for recovery.
- Underweight calls: the specific upgrade conditions.
- Constructive calls: the proof points you'll watch.

**Self-correction.** When revisiting old work, say what you got wrong and why. It earns trust.

**Bearish pieces.** Acknowledge what's genuinely good about the subject before taking apart the investment case.

## Comparisons and valuation

- Comparison types: peer multiples, historical self-comparison, cross-sector analogs (protocol versus a traditional finance business), unit economics side by side.
- Pick a methodology that fits how the subject earns: P/S or FDV/fees for fee-generating protocols, P/E or DCF for cash-flowing companies, sum of the parts for multi-line businesses.
- A valuation without context is a number. Always show where it sits against peers and against the subject's own history.
- Explain why each comp belongs. An undifferentiated comp set weakens the whole section.

## Scenarios

Use formal bear/base/bull when the outcome depends on two or three uncertain inputs. Each case needs specific conditions, the resulting metrics, the multiple, and the implied value.

- The **bear case as floor** argument is powerful when the downside is limited: "Even in our bear case, the token trades at a discount to backing."
- Multi-dimensional scenarios work when two inputs are independent (for example, adoption and take rate). A small grid beats three blended cases.
- When scenarios are overkill, use a single sensitivity table or a "what has to be true" list.

## Argument structures

Pick the one that fits the piece:

- **Pyramid**: one thesis, three to four pillars, evidence under each. Good for company reports.
- **Hub and spoke**: one protocol at the center, product lines as spokes, each with its own evidence. Good for deep dives.
- **Funnel**: broad market, narrow to a segment, narrow to the subject. Good for market structure pieces.
- **Linear cascade**: one development leads to the next. Good for periodic updates.
- **Problem, solution, opportunity**: for novel protocols the reader hasn't seen.
- **Inverted pyramid**: lead with the conclusion, then work down to supporting detail. Good for bearish pieces.
- **Evidence chain**: each finding sets up the next. Good for technical or macro work.

Three or four pillars is the sweet spot. Two feels thin; five or more dilutes.

## Anti-patterns

1. **Assertion without evidence.** A claim with no number behind it.
2. **Data dump.** Numbers with no interpretation.
3. **Missing mispricing.** No reason the current price is wrong.
4. **Unfalsifiable thesis.** Nothing could prove it wrong.
5. **Generic risks.** Boilerplate that applies to any protocol.
6. **Isolated valuation.** A multiple with no comps or history.
7. **Consensus thesis.** Restating what everyone already believes.
8. **One-sided argument.** No counterevidence engaged.
9. **Broken chain.** A logical step skipped between evidence and conclusion.
10. **Promotional tone.** Reads like the project's marketing.
11. **Hedge everything.** So qualified the reader can't find your view.
12. **Stale assumption.** Inputs that no longer reflect current data.
13. **Undifferentiated comps.** Peers chosen without explaining why.
14. **No time horizon.** A call with no "by when".
