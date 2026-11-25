---
name: job-scout
description: Scan the user's job boards and Telegram channels for new roles they are qualified for, dedupe against their tracker, and add the good ones. Use when the user says "find new jobs", "scan the boards", "check the channels", "update my jobs db", "job scout", or similar. On first use, interview them and write a gitignored context file before scraping.
---

# Job scout

Pipeline: **tracker export → scrape boards + Telegram channels → filter + qualification check (script) → review → tracker insert → mark seen → update background file**.

Skill dir = the directory containing this file. Personal files under `context/` and `data/` are gitignored. Never commit them, never copy another user's context, and never invent experience.

## First run

Before any scrape, these files must exist:

- `context/<slug>-background.md` (narrative source of truth)
- `context/application-profile.md`
- `config.json` (per-user filters; copy of `templates/config.json`, gitignored)
- `data/profile.json` (Notion id, background filename; overlays `config.json`)
- `data/boards.txt`
- `data/channels.txt` (may contain only comments)
- `data/seen.json` (`[]` if new)

If any are missing, stop. Do not scrape. Ask for the missing pieces only, and do not overwrite a file that already has their data. Use the question tool when the client has one; otherwise ask in chat. One pass, then write the files from `templates/` and show the paths.

Ask:

1. Legal name, preferred name, and the slug to use in the filename.
2. Contact fields they want stored (email, phone, city, work authorization, LinkedIn, site, GitHub). Skip any they do not want on disk.
3. Roles in scope, and hard exclusions (functions, seniority, skills they will not claim).
4. Location rule: which cities count as local, is remote ok, drop onsite elsewhere?
5. Experience caps: max years total, max years in a function (PM or otherwise), travel cap, and whether the cap is a stretch or a hard drop.
6. Companies already applied to or in the pipeline.
7. Where matches go: a Notion data source id, or a markdown report only.
8. Job board URLs and public Telegram channel URLs (`https://t.me/<name>`). Private `t.me/c/` and `t.me/+` links are listed but not scraped.
9. Voice rules and claims to avoid, if they want applications written for them.

Write `context/<slug>-background.md` from `templates/background.md`, `context/application-profile.md` from its template, and `data/profile.json` from `templates/profile.json`. If `config.json` is missing, copy `templates/config.json` to `config.json` and fill it from their answers. Never overwrite an existing `config.json`. Put board and channel URLs in `data/boards.txt` and `data/channels.txt`. Set `data/seen.json` to `[]` if it is missing.

In the new `config.json` set `location.local_markers` to their cities, add those cities to `location.allow`, set `qualification.max_years`, `qualification.max_years_pm`, and `qualification.max_travel_pct`, and set `applied_companies`. Leave `tiers` and `exclude_titles` unless they asked to change them. `profile.json` `background` is the background filename. `profile.json` `notion.data_source_id` is the tracker. A `profile.json` key overlays the same key in `config.json`.

Confirm the files exist, then continue. On later runs, read the background file first. It overrides this skill wherever they differ.

## Paths

- Boards: `<skill>/data/boards.txt` (one URL per line; non-`http` lines ignored)
- Channels: `<skill>/data/channels.txt` (same rules; public `t.me` links)
- Script: `<skill>/scripts/scout.py` (stdlib Python, no installs)
- Filters: `<skill>/config.json` (gitignored, generated from `templates/config.json` on first use), overlaid by `<skill>/data/profile.json`
- Seen-state: `<skill>/data/seen.json`
- Run output: a fresh scratch folder, e.g. `$SCRATCH/scout-YYYY-MM-DD/`

Tracker: `data/profile.json` → `notion.data_source_id`. If it is empty, skip Notion and write the report only.
When it is set, the database properties used here are `Role` (title), `Company` (text), `Status` (Not started / Top Pick / Applied / Call Scheduled / Closed), `URL` (url, write as `userDefined:URL`), `Notes` (text). If a call fails on schema, re-fetch the data source and use what it says.

## Steps

### 1. Export existing tracker rows
If `notion.data_source_id` is set, query with the Notion MCP (`notion-query-data-sources`, SQL mode), substituting that id:
```sql
SELECT "Role","Company","Status","userDefined:URL" AS "URL" FROM "collection://<data_source_id>"
```
Write the result rows as a JSON array to `$OUT/existing.json`. If there is no Notion id, write `[]`. Companies in the export count as "already in pipeline" (exact normalized name match), except rows whose status is in `nonblocking_statuses` (Closed/Lost/No-Go). Their other qualifying roles still get checked and land in `pipeline_company_hits.json` and a "roles at companies already in the pipeline" section of `summary.md`; review those too.

### 2. Run the scraper
```bash
python3 -I <skill>/scripts/scout.py run --boards <skill>/data/boards.txt --channels <skill>/data/channels.txt --existing $OUT/existing.json --out $OUT
```
Takes a few minutes. Channels are scraped in the same run (public `t.me/s/<name>` preview, paginated until `max_age_days` or `tg_max_pages`). `--only <substr>` limits to matching boards and channels; `--include-seen` ignores seen-state; `--no-channels` skips Telegram.
Outputs `candidates.json` (ranked, one per company, with `also_open` alternates, `years_required`, `years_snippets`, `flags`, and a `description` excerpt), `unqualified.json` (dropped by the qualification check, with the reason), `summary.md` and `board_status.json`.

The qualification check fetches each surviving posting through the ATS APIs and drops it if any of these hold. The thresholds are in `config.json` under `qualification`.
- It asks for more PM years than `qualification.max_years_pm`, or more total years than `qualification.max_years` (from `profile.json`, else `config.json`). Anything at the cap that you still add must say **STRETCH** in Notes, with the angle from the background file.
- Travel is above 25%.
- It requires being in an office outside Boston.
- It requires a blocker skill: Solidity, AML/KYC, forensics, CFA, fund accounting, quant and similar.

How it scrapes:
- **Getro** boards (most VC boards): SSR only shows 20 jobs, so it runs each keyword in `getro_queries` via `?q=`.
- **Ashby / Greenhouse / Lever / Workable / Gem** URLs: public JSON APIs.
- **Other careers pages**: follows embedded ATS links (e.g. a portfolio page).
- **Telegram**: public channels in `data/channels.txt`. Digest lines (`Company is hiring Title`) and structured posts (`Title` / `at Company` / location / apply link) become jobs, tagged `tg:<channel>`, with crypto context set. Private `t.me/c/` and `t.me/+` links are listed as `tg-private` and are not fetched. Do not log in or bypass that.
- **Consider**-powered boards need a CSRF session for their API and are **not** scraped. They're listed under "Boards needing manual check", and step 2b covers them. Don't try to bypass the CSRF.

Paycom, TrueUp (Cloudflare; Firecrawl works, but only ~10 listings are public) and similar pages need Puppeteer or Firecrawl.

It also writes `near_misses.json`: jobs that passed location, seniority and qualification but matched no title tier. Step 3 reviews them.

### 2b. Required: cover the manual and Consider boards
Do this on every run unless the context file says not to. The scripted boards alone miss roles.

**Consider boards → ATS boards (do once per board, then it's free).**
1. Firecrawl-scrape `<board>/companies` with `formats: ["links"]` (1 credit). Collect the `/jobs/<slug>` company slugs.
2. Probe the free ATS APIs for each slug and for variants (strip `-labs`, `-com`, `-network`, `-protocol`, `-finance`, `-xyz`, and drop the dashes):
   - Ashby: `api.ashbyhq.com/posting-api/job-board/<v>`
   - Greenhouse: `boards-api.greenhouse.io/v1/boards/<v>/jobs`
   - Lever: `api.lever.co/v0/postings/<v>?mode=json`
   - Workable: `apply.workable.com/api/v1/widget/accounts/<v>`
3. Check every hit is the right company, because slugs collide. Ashby `safe` is Safe Software, `neon` is Neon Postgres and `slope` is a payments startup. Workable returns 200 with 0 jobs for slugs that don't exist, so drop 0-job hits.
4. Append the verified board URLs to `boards.txt` (e.g. `https://jobs.ashbyhq.com/<v>`) and run `scout.py run --boards <new list> --existing ... --out ...` on them.

The crypto Consider boards were mapped on Nov 12 2026; the results are the "Crypto ATS boards mapped from Consider" block in `boards.txt`. Not yet mapped: the large generalist boards jobs.bvp.com, jobs.gv.com and jobs.lsvp.com. Retry `apply.workable.com/hextrust` if it returns 429. Companies with no public ATS (Worldcoin, Wintermute, Gnosis, Celestia, Berachain, Scroll, Taiko, Livepeer, Obol, Drift, Certora, Fordefi, deBridge, RISC Zero, Sygnum and others) need a Firecrawl scrape of the Consider `/jobs/<slug>` page; do that for high-value ones only.

**Other manual boards.** Firecrawl-scrape each with `formats: ["markdown"]`, `onlyMainContent: true` (1 credit), or `["links"]` for JS-heavy careers pages. Large results are saved to a file; parse them with `python3 -I` instead of reading them whole. Notes from Nov 12 2026:
- Worth scraping every run: `cryptocurrencyjobs.co/remote/` (check the age column, many listings are 20+ weeks old), `web3.career/research-jobs` and `web3.career/product-manager-jobs`, `talent.yzilabs.com` (mostly Asia-based; `?page=` is ignored, so paginate with the headless browser by clicking "Next →", then curl each `/jobs/<id>` page, which is server-rendered). Never call its `POST /api/jobs` (that posts a job).
- `talent.dao5.com` is a company directory with no job listings. `typhoncap.com` and `ascensiveassets.com` have no real openings. `bitwiseinvestments.com/careers` renders empty and has no public ATS. CoinShares is Teamtailor (`careers.coinshares.com/jobs`, ops/data/sales only).
- `mgmtboston.com/boston-tech-big-board` is a company directory. Use it to find Boston companies to add as ATS boards, not as a job list.

**When Firecrawl credits run out:** use a headless browser instead. Write a small Playwright or Puppeteer script in the scratchpad (`npx playwright` or `npm i puppeteer` in a scratch folder, never in the repo) that loads the page, waits for the job list, and dumps the link text and hrefs to JSON. Respect each site's terms and don't hammer it; one page load per board is enough. Consider's CSRF rule still applies, so load the public page only and don't call its API.

### 2c. Optional: Firecrawl Alexandria job search (paid, low yield)
Firecrawl is connected through the claude.ai connector (`mcp__claude_ai_Firecrawl__alexandria_library_read`). Don't add a second Firecrawl MCP server. Each call costs about 5 credits, so run it only when the user asks for a wider sweep, or when the boards turned up almost nothing. Batch up to 10 calls in one request.

The Nov 12 2026 test found nothing qualified. Indeed's crypto results were mostly compliance, forensics and sales roles. YC PM roles were nearly all 5+ years. Built In returned one VP role. The niche boards in `boards.txt` are the better source.

What works:
- `indeed-com` `jobs/search`: use plain-phrase `query` (e.g. "crypto research analyst", "DePIN analyst"), `remote: true`, `posted_within_days: 14`, `sort: "date"` and `country: "US"`. For Boston, use `location: "Boston, MA"`. Boolean `OR` and `title` + `query` together return 0 results. Location-only searches ignore keywords and come back as noise. Jobs are at `data.jobs[]` (`title`, `employer.name`, `location.formatted`, `posted_at`, `source_url`, `apply_url`). The `attributes` labels show years ("3 years") and seniority ("Senior level").
- `ycombinator-com` `companies/job_search`: use `role: "product"`, `remote_allowed: true` and `country: "US"`. Jobs are at `data.records[]`. Drop anything with `minExperience` above "3+ years".
- `myworkdayjobs-com` `search_jobs`: use it for big Boston firms the scraper can't reach (State Street and the like), keyed by career-site URL.
- Skip `theirstack` and `crustdata`, which are priced per record.

Run these hits through the same step-3 review, and check the dedupe against `existing.json` by hand. Hits aren't in `seen.json` automatically, so add the reviewed ones with `seen --add-urls`.

### 3. Review candidates (your judgment, not just the score)
Read `summary.md` and `candidates.json`. The script is a coarse pre-filter, so apply the background file and drop anything that doesn't genuinely fit. Telegram hits use the same filters; a channel post with no location is kept only because `keep_unknown` is on, so check location yourself before adding it.

**Always review `near_misses.json` too.** Skim every title for roles the tier regexes missed (e.g. "Member of Product", "Founding PM", odd strategy titles), then apply the same qualification check. If a pattern keeps getting missed, add it to `tiers` in `config.json`. Mark reviewed near-misses seen with `seen --add-urls` (pipe the URLs through `xargs`; zsh won't split an unquoted variable).

**Qualification is a hard requirement. Only add a role if the background file shows they meet its stated must-haves.** For every candidate, read the requirements section of `description` and check it against the background file:
- Years required. The regex can misread these (e.g. it once read "12+" as "2+"), so read the snippets yourself.
- Required domain experience.
- Required tools.
- Anything in "Claims to avoid".

If `qual` says no description was fetched, get the requirements yourself: use the ATS API (Ashby `api.ashbyhq.com/posting-api/job-board/<slug>` → `descriptionPlain`; Greenhouse `boards-api.greenhouse.io/v1/boards/<slug>/jobs/<id>`; Lever `api.lever.co/v0/postings/<slug>/<id>`), or WebFetch the posting. Ashby pages are JS-rendered, so use the API for those. If they don't meet the must-haves, don't add the role; list it under "skipped (not qualified)" in the report.

Apply the background file for which tiers, locations, seniority, and functions are in scope, and for companies already applied to. `data/profile.json` `applied_companies` is what the script excludes; keep it in sync when the background file gains an application. Add without asking only if the background file says to. Otherwise show the shortlist and add what they confirm.

### 4. Add to the tracker
If there is no Notion id, append the same fields to `$OUT/added.md` and stop this step. Otherwise `notion-create-pages` with `parent: {"data_source_id": "<notion.data_source_id>"}`, one page per job, all in a single call:
```json
{"properties": {"Role": "<title>", "Company": "<clean company name>", "Status": "Not started",
                "userDefined:URL": "<url>", "Notes": "New find (<board> board). <Remote|Boston>, posted ~<Mon D>. <flags/one-line why>"}}
```
- Use `Status: "Top Pick"` only for standout Tier-1 fits.
- Prefer the board URL the user can open; clean company names (e.g. `uniswap` → `Uniswap Labs`).
- Mention notable `also_open` roles in Notes (e.g. "Also open: PM, Hermes Business").
- Match the existing Notes style, e.g. `New find (Solana board). Remote, posted ~Oct 27. Data + Solana, more DevRel than research`.

### 5. Mark reviewed jobs as seen
After inserting (and for candidates you rejected), so they don't come back next run:
```bash
python3 -I <skill>/scripts/scout.py seen --add $OUT/candidates.json
```
This also marks everything in `unqualified.json`. To let a rejected-for-now job resurface later, instead mark only specific URLs: `seen --add-urls URL ...`.

### 6. Update the background file
In the file named by `profile.json` `background`, add the new roles to "Not started" and the notable skipped ones to "Ruled out", then bump "Last updated". Do not put another person's facts in it.

### 7. Report
Brief summary covering:
- N added, with Notion links.
- N skipped and why, in one line, including not-qualified ones.
- Boards and channels still unread after step 2b, including `tg-private` channels, and any new ATS boards added to `boards.txt`.
- Any boards that errored.
- Firecrawl credits used this run.

## Tuning
Edit `config.json`, not the script: `tiers` (title regex → points), `exclude_titles`, `exclude_seniority`, `exclude_senior_pm`, `location`, `keywords`, `crypto_boards` (host substrings treated as crypto context), `applied_companies`, `max_age_days`, `min_score`, `max_candidates`, `getro_queries`. When the user reports a miss or a bad match, adjust the relevant regex and re-run with `--only` on that board to confirm.

## Pruning boards
Keep boards that can list roles matching the location rule in the background file. About once a month, or when a board keeps producing nothing, audit them:
```bash
python3 -I <skill>/scripts/board_audit.py $OUT/locaudit.json
```
It writes per-board `ok` (US-remote/Boston), `bad` (in-person elsewhere or non-US remote) and `unknown` counts. Comment out boards with `ok` + `unknown` = 0 under the "Removed … in-person only" block at the bottom of `boards.txt`, and say which ones in the report. Exceptions:
- Keep boards whose only location is a bare "United States" (e.g. Securitize, Stability AI). The filter counts those as onsite, but they are often remote.
- Keep boards with even one remote role.
- Keep manual pages with no openings unless the firm is known to work in-office only.
