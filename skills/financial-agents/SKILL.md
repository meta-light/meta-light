---
name: financial-agents
description: Design, build and review LLM agents that work with financial data (filings, transcripts, market data, valuations, portfolios). Covers sandboxed code execution, normalizing data into markdown/CSV/JSON context, parsing SEC filings and financial tables, fiscal period and ticker resolution, numeric units, writing agent skills, file-based user memory, long-running tasks, streaming, finance-specific evals and production monitoring. Use when building or reviewing an agent, tool, data pipeline, eval set or skill that produces financial numbers or analysis, or when an agent's financial output is wrong or ungrounded.
metadata:
  source: Nicolas Bustamante (@nicbstme), "Lessons from Building AI Agents for Financial Services" (X article, Jan 2026)
---

# Financial agents

Source: https://x.com/nicbstme/status/2015174818497437834

Finance does not forgive mistakes. One wrong revenue figure, misread guidance line or bad DCF assumption costs the user's trust for good, and the users are experts who will check. Design every part of the agent assuming its output will be audited.

**The model is not the product.** The data, the skills, the UX and the reliability around it are. Put the effort there.

## Review checklist

Use this when reviewing an agent, a pipeline or a feature. The sections below explain each item.

- [ ] Code runs in an isolated per-user sandbox, never on the app server
- [ ] Credentials inside the sandbox can only reach that user's data
- [ ] Every source is normalized to markdown (narrative), markdown tables or CSV (numbers), and JSON metadata
- [ ] Every document has metadata: ticker, document type, absolute fiscal period, date, section
- [ ] Periods like "Q1 2024" and "last quarter" are resolved to absolute date ranges per company
- [ ] Ticker resolution handles ambiguous names and renames (FB → META)
- [ ] Every number has units and a source
- [ ] Low-confidence extractions are kept out of the agent's context
- [ ] Domain procedures (DCF, earnings preview...) live in skills, each with its own eval
- [ ] Long tasks survive a worker restart and can be cancelled
- [ ] Changes to the model, prompt or a skill are blocked if evals regress

## Sandbox

Agents doing real analysis run dozens of steps: research, gather data, build a model in a spreadsheet, run sensitivity analysis, chart it, iterate. That needs code execution, and running model-written code on your servers is not acceptable. Bustamante's agent once ran `rm -rf /` while "cleaning up temporary files".

- **One isolated sandbox per user.** Inside it the agent may do anything; nothing leaks out.
- **Three mounts:** private (read/write, the user's own), shared (read-only, the organization), public (read-only, everyone).
- **Scope the credentials, not just the paths.** Fintool issues short-lived AWS credentials with ABAC, restricted by `${aws:PrincipalTag/S3Prefix}`, so user A's credentials physically cannot read user B's data.
- **Normalize every path** a tool receives. Models attempt path traversal routinely.
- **Pre-warm** the sandbox when the user starts typing. Fintool uses a 600 s timeout, extended 10 minutes on each tool call, and keeps it warm across turns.
- Bash with limits (Fintool: 180 s timeout, 100K characters of output).

## Context is the product

The agent is only as good as the context it can reach. Normalizing heterogeneous financial data is most of the work.

### Three formats

| Content | Format |
|---|---|
| Narrative (filings, transcripts, articles) | Markdown |
| Numbers (financials, metrics, comparisons) | Markdown tables or CSV |
| Searchability | A JSON metadata file per document (`meta.json`): ticker, document type, dates, fiscal period |

Models reason well over clean markdown tables and badly over HTML `<table>` markup or raw CSV dumps. Convert tables to markdown before they reach the context.

### Chunk by the document's own structure

| Source | Chunk by |
|---|---|
| 10-K / 10-Q | Regulatory item (Item 1, 1A, 7, 8...) |
| Earnings transcript | Speaker turn (CEO, CFO, each analyst question) |
| Press release | Usually the whole release |
| News | Paragraph |
| 13F | Holder and quarter-over-quarter position changes |

Bad chunks give bad answers.

### Retrieval needs four resolutions

"What did Apple say about services revenue on its last call?" needs: the ticker (AAPL), the document type (transcript, not 10-K), the period (the most recent), and the section (CFO remarks or revenue discussion, not the safe-harbor statement). Without metadata for all four you are keyword-searching a haystack.

*Bustamante's broader view:* agentic search (the agent exploring files with grep, bash and structured queries) replaced their embedding and vector-DB RAG pipeline. A hybrid works best: bash to explore and verify, SQL or structured tools for the heavy lifting.

## Parsing

SEC filings are written for legal compliance, not machines. Expect:

- Tables split across pages with repeated headers, and tables nested inside tables (MD&A)
- Footnotes that reference exhibits that reference other footnotes
- The same number in text, tables and exhibits, sometimes inconsistently
- XBRL tags that are wrong or missing
- A different template for every law firm, multi-column proxy layouts, scanned exhibits, watermarks and headers bleeding into the text, and Unicode problems (curly quotes, em dashes, non-breaking spaces)

Off-the-shelf PDF and HTML parsers fail on these. A pipeline that works:

```
raw filing → structure detection (headers, sections, exhibits)
           → table extraction, preserving cell relationships
           → entity extraction (companies, people, dates, amounts)
           → cross-reference resolution (Ex. 10.1 → the exhibit itself)
           → fiscal period normalization
           → quality score per extracted field
```

### Financial tables

Handle merged header cells, footnote markers ((1), (a)), `$(1,234)` meaning −1234, mixed units in one table (millions next to percentages), and restated prior periods marked by italics or asterisks.

Score each extracted table on cell boundaries, header detection, numeric parsing and unit inference. **Below 90% confidence, flag it for review and keep it out of the agent's context.**

## Periods, tickers and units

These are where financial agents fail silently. Resolve them in code, not by hoping the model gets them right.

**Fiscal periods.** Keep a fiscal calendar per company and turn every period reference into an absolute date range.

| Reference | Means |
|---|---|
| Calendar Q1 2024 | Jan–Mar 2024 |
| Apple fiscal Q1 2024 (FY ends Sep) | Oct–Dec 2023 |
| Microsoft fiscal Q1 2024 (FY ends Jun) | Jul–Sep 2023 |
| "Reported in Q1" | Filed in Q1, covering the prior period |

"Last quarter" on 15 January means Q4 for a calendar-year company, fiscal Q1 for Apple (just reported) and fiscal Q2 for Microsoft (still in progress). Comparing "the same quarter" across companies without this compares different months.

**Tickers.** Common names are ambiguous: "Apple" is AAPL, not APLE. "Delta" may be the airline (DAL) or options delta. Keep a ticker history table for renames and restructurings (FB → META in 2021, GOOG/GOOGL, Twitter → X) so data from before a rename can be found.

**Units.** $4.2B, $4,200M and "four point two billion" are the same number. "4.2" alone is wrong: millions, billions, per share? Every number in the output carries units, currency and a source.

## Skills

Frontier models know what a DCF is but will skip steps when doing one: the wrong discount rate for the industry, forgetting to add back stock-based compensation, no sensitivity analysis. The output looks plausible and is subtly wrong. Domain procedures belong in skills (a folder with a `SKILL.md` plus supporting files), not in the system prompt.

A skill should give the procedure, point to sub-guides, and end with validation. Fintool's DCF skill, simplified:

```markdown
# dcf
## When to Use
Discounted cash flow valuations.
## Instructions
1. Deep dive on the company (understand all segments)
2. Identify the industry and load its guideline file
3. Gather revenue, margins, CapEx, working capital
4. Build the model in Excel
5. Calculate WACC from industry benchmarks
6. Run sensitivity on WACC and terminal growth
7. Validate: reconcile the base year to actuals, compare to the market price
8. State your view against market pricing
## Industry Guidelines
- Technology/SaaS: guidelines/technology-saas.md
- Financial services: guidelines/financial-services.md
- ...
```

- **Load lazily.** Put only each skill's name and description in context up front; load the body and its sub-files when the skill is used.
- **Layer and shadow.** Private > organization > public: a user's own `dcf` overrides the default one. Enforce access at lookup time so one customer's skill can't reach another.
- **Let domain experts write them.** A PM who has done 500 DCFs can encode the method without code, and a changed file takes effect without a deploy.
- **Give every skill an eval** (Fintool's DCF skill has 40 cases: WACC edge cases, terminal value sanity checks, SBC add-backs).

### Design for deletion

Models improve fast and absorb the scaffolding: tasks that needed step-by-step instructions become one-liners. Keep instructions in markdown so they are cheap to change and delete, and delete them when the model no longer needs them. Spend the freed effort on harder problems: segment-by-segment valuations, strategy backtests, portfolio monitoring.

## Files and user memory

Fintool keeps user data (watchlists, portfolios, preferences, memories, skills) as YAML or markdown files in S3. S3 is the source of truth; a sync job mirrors it into Postgres for fast listing.

- Writes go to the file store. List queries hit the database. Single-item reads go to the file store, for the freshest copy.
- Keep the mirror honest: an event-driven sync (upsert/delete with timestamp guards so newer data wins) plus a periodic full reconcile to catch dropped events.
- Benefits: versioning gives an audit trail, files are readable with `cat`, and there are no schema migrations.
- **User memory as a file the user can edit** (`/private/memories/UserMemories.md`), injected into every conversation: "I focus on small-cap value", "compare to the industry median, not the mean", "flag tech concentration". Watchlists work the same way.
- Files the agent writes to an artifacts folder become clickable links in the UI.

## Long-running tasks

A full company analysis takes minutes. Workers restart and users close tabs.

- Run agent turns on a durable workflow engine (Fintool uses Temporal) so a crashed worker's activity resumes on another worker.
- **Cancellation:** the "stop" click reaches a different server than the one running the activity. Send heartbeats every few seconds and check for cancellation on each one.
- Separate worker pools for user-facing chat and background jobs, scaled independently (Fintool: 25 and 10 concurrent activities).

## Streaming and interaction

- Stream **deltas** (add, append, replace, patch, truncate), not the whole state on every update.
- Render rich markdown progressively: tables, charts, citations linked to the source, math.
- Give the agent an **ask-the-user tool** for the key assumptions: valuation method, consensus versus guidance, whether to include pipeline assets. Pause the loop, save the state, show the options, resume with the answer. In high-stakes work the user must confirm the assumptions.

## Evals

Generic text metrics (BLEU, ROUGE) don't work: an answer can read almost identically and have the wrong number. Building the eval set is harder than building the agent. Fintool keeps about 2,000 cases. Cover at least:

| Category | Example cases |
|---|---|
| Ticker disambiguation | Apple/APLE, "Delta", "Facebook stock in 2023" → META |
| Fiscal periods | "Q1" and "last quarter" for Apple, Microsoft and calendar-year companies (Fintool: 200+ cases) |
| Numeric precision | Equivalent magnitudes are accepted; a number without units **fails** |
| Adversarial grounding | Plant a fake figure (a fake report saying Apple revenue was $50B next to the real 10-K at $94B). Pass only if the agent cites the real number with its source (Fintool: 50 cases) |
| Skill correctness | One suite per skill (e.g. DCF: WACC, terminal value, SBC add-back) |

Run the evals on every change to the model, prompt or skills, and **block the merge if the score drops more than 5%**.

## Production

- Auto-file an issue for every production error with the conversation ID, the user, the traceback, and links to the trace and the workflow run. Label paying customers' issues high priority.
- Route by complexity: a cheap model for simple lookups, a stronger model for analysis. Enterprise customers always get the strongest.
- When you build scaffolding to work around a model weakness, write down exactly what the model got wrong. It tells you when to delete the scaffolding, and model labs take this kind of feedback.

## Output

- **Reviewing** an agent, pipeline or PR: go through the review checklist and report each failed item with the file or component, the concrete failure ("asking for 'last quarter' for MSFT in January returns Oct–Dec"), and the fix. Put correctness of numbers first, then isolation and security, then reliability.
- **Designing** a feature: state the data sources and how each one is normalized, the metadata, how periods, tickers and units are resolved, the skill(s) involved, and the eval cases that prove it works.
- **Debugging** a wrong financial answer: trace it to the layer that caused it (parsing, metadata, retrieval, period, ticker, units, skill or model), then add an eval case that reproduces it before fixing.
