/**
 * The follow list: who this bot copies.
 *
 * The FOMO API is keyed to an API key, not to your FOMO account, so it cannot
 * tell us who you follow (a trader exposes a `followers` count, never a
 * `following` list). The list therefore lives in `follows.json`, which you own:
 *
 *   npx tsx src/follows.ts list
 *   npx tsx src/follows.ts add @CryptoKaleo --weight 2 --max 250
 *   npx tsx src/follows.ts import following.txt      # bulk, from the app
 *   pbpaste | npx tsx src/follows.ts import          # bulk, from the clipboard
 *   npx tsx src/follows.ts verify @unipcs                # spends 1 of 25/mo
 *   npx tsx src/follows.ts usage
 *   npx tsx src/follows.ts remove prevaile
 *   npx tsx src/follows.ts mute unipcs
 *
 * `add` and `import` check each handle against its captured trade history,
 * which costs no wallet resolution, so a typo is caught without spending the
 * scarcest quota on the plan. `verify` is the one command that spends it.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { FomoClient, FomoNotFoundError, FomoRateLimitError } from "./fomo.ts";
import type { Trader, Wallets } from "./fomo.ts";
import { Budget, BudgetError, governedFetch, formatBudget } from "./budget.ts";
import { FOLLOWING, MY_HANDLE, TRADER_CACHE_FILE } from "./config.ts";

export const FOLLOWS_FILE = "follows.json";

/** One followed account, as stored in `follows.json`. */
export interface Follow {
  /** FOMO handle, without the `@`. Matched case-insensitively against alerts. */
  handle: string;
  /** Position-size multiplier applied to the bot's base size. Default 1. */
  weight?: number;
  /** Hard per-signal ceiling in USD for this trader, overriding the global one. */
  maxUsd?: number;
  /** Only copy these chains for this trader. Omit to allow the bot's global set. */
  chains?: string[];
  /** Keep the row but stop copying. */
  mute?: boolean;
  /** Free-text reminder of why they are on the list. */
  note?: string;
}

/** A {@link Follow} checked against the API. */
export interface ResolvedFollow extends Follow {
  /** Whether this account should be copied. A throttled lookup stays `true` -
   * the handle is fine, we just could not enrich it right now. */
  ok: boolean;
  /** Why it failed, when `ok` is false. */
  reason?: string;
  /** Set when the row is copyable but unverified, e.g. a throttled lookup. */
  warning?: string;
  displayName?: string;
  /** PnL derived from onchain trades rather than self-reported. */
  verified?: boolean;
  pnlUsd?: number;
  pnl24h?: number;
  trades?: number;
  followers?: number;
  wallets?: Wallets;
  /** Their median hold time - how fast you have to be to copy them. */
  avgHoldSeconds?: number;
  /** Open / closed positions across their whole captured history. Comes from
   * `/trades`, which costs no wallet resolution, so this is the enrichment we
   * can afford on every boot. */
  activeCount?: number;
  closedCount?: number;
  /** When the wallet resolution behind `wallets`/`pnlUsd` was paid for. */
  verifiedAt?: string;
}

/* ----------------------------------------------------------- trader cache */

interface CachedActivity {
  checkedAt: string;
  available: boolean;
  activeCount?: number;
  closedCount?: number;
}

interface CachedTrader {
  /** When the wallet resolution was paid for. Absent if we only ever took the
   * free path for this handle. */
  fetchedAt?: string;
  trader?: Trader;
  /** The free `/trades` snapshot, re-checked on a TTL so a restarting bot
   * costs no requests. */
  activity?: CachedActivity;
}

/** Wallet resolutions are 25 a month and never come back, so a resolved trader
 * is cached to disk permanently and re-read on every boot. Deleting this file
 * throws away paid-for data. */
export function loadTraderCache(file = TRADER_CACHE_FILE): Map<string, CachedTrader> {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, CachedTrader>;
    return new Map(Object.entries(parsed).map(([handle, entry]) => [handle.toLowerCase(), entry]));
  } catch {
    return new Map();
  }
}

export function saveTraderCache(cache: Map<string, CachedTrader>, file = TRADER_CACHE_FILE): void {
  const directory = dirname(file);
  if (directory && directory !== ".") mkdirSync(directory, { recursive: true });
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(cache), null, 2)}\n`);
}

function fromActivity(follow: Follow, activity: CachedActivity): ResolvedFollow {
  return {
    ...follow,
    ok: true,
    ...(activity.activeCount === undefined ? {} : { activeCount: activity.activeCount }),
    ...(activity.closedCount === undefined ? {} : { closedCount: activity.closedCount }),
    ...(activity.available ? {} : { warning: "no captured trades - unverified" }),
  };
}

function fromTrader(follow: Follow, trader: Trader, fetchedAt: string): ResolvedFollow {
  return {
    ...follow,
    // Prefer the API's casing so logs match what FOMO shows.
    handle: trader.handle ?? follow.handle,
    ok: true,
    displayName: trader.displayName,
    verified: trader.verified,
    pnlUsd: trader.pnlUsd,
    pnl24h: trader.pnl?.["24h"],
    trades: trader.trades,
    followers: trader.followers,
    wallets: trader.wallets,
    avgHoldSeconds: trader.averageHoldTimeSeconds ?? trader.profile?.averageHoldTimeSeconds,
    verifiedAt: fetchedAt,
  };
}

/** Strip the `@`, trim, lowercase - the form used for alert matching. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function loadFollows(file = FOLLOWS_FILE): Follow[] {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : (parsed as { follows?: unknown }).follows;
  if (!Array.isArray(rows)) throw new Error(`${file} must be an array of follows`);
  const seen = new Set<string>();
  const follows: Follow[] = [];
  for (const row of rows) {
    const entry = typeof row === "string" ? { handle: row } : (row as Follow);
    if (!entry?.handle) continue;
    const handle = entry.handle.trim().replace(/^@+/, "");
    const key = handle.toLowerCase();
    if (seen.has(key)) continue; // last write wins would hide a duplicate typo
    seen.add(key);
    follows.push({ ...entry, handle });
  }
  return follows;
}

/** The roster the bot and the watcher actually use: {@link FOLLOWING} from
 * config.ts, with `follows.json` layered on top.
 *
 * The hardcoded list owns *who*; the file owns *how* - weight, caps, chains,
 * mute. Keeping them apart means editing one account's size never risks
 * dropping another from the roster, and a handle only ever appears once.
 * Handles present only in the file are kept, so `follows add` still works. */
export function followRoster(file = FOLLOWS_FILE): Follow[] {
  const overrides = new Map(loadFollows(file).map((follow) => [normalizeHandle(follow.handle), follow]));
  const roster: Follow[] = [];
  const seen = new Set<string>();
  for (const handle of FOLLOWING) {
    const key = normalizeHandle(handle);
    if (key === normalizeHandle(MY_HANDLE) || seen.has(key)) continue;
    seen.add(key);
    // The file's handle spelling is ignored: config.ts is the source of truth
    // for the roster, and the match is case-insensitive anyway.
    roster.push({ ...overrides.get(key), handle });
  }
  for (const [key, follow] of overrides) {
    if (!seen.has(key) && key !== normalizeHandle(MY_HANDLE)) roster.push(follow);
  }
  return roster;
}

export function saveFollows(follows: Follow[], file = FOLLOWS_FILE): void {
  writeFileSync(file, `${JSON.stringify(follows, null, 2)}\n`);
}

/** Index a follow list by normalized handle, for O(1) alert matching. */
export function followIndex(follows: Follow[]): Map<string, Follow> {
  return new Map(follows.map((follow) => [normalizeHandle(follow.handle), follow]));
}

export interface ResolveOptions {
  /** Parallel lookups. Low by design: we are pacing against 60 req/min. */
  concurrency?: number;
  /** Total wall-clock budget for the whole pass. Enrichment is a nicety - the
   * bot must not sit in 429 backoff instead of watching the stream. */
  deadlineMs?: number;
  /** Spend wallet resolutions on handles that are not cached yet. Off by
   * default: at 25 a month, a 24/7 bot that resolved on every boot would be
   * dry within a day. `follows verify` turns it on deliberately. */
  verify?: boolean;
  /** Shared ledger, so a resolution spent here is remembered everywhere. */
  budget?: Budget;
  /** Pre-loaded cache; pass one to avoid re-reading the file per call. */
  cache?: Map<string, CachedTrader>;
  /** Where the cache lives. Defaults to {@link TRADER_CACHE_FILE}. */
  cacheFile?: string;
  /** Retries per lookup. Default 0: the bot's boot must not sit in backoff
   * while the stream waits. Interactive commands pass 2, because the API's
   * auth backend flaps and a one-shot check should ride it out. */
  maxRetries?: number;
  /** How long a free `/trades` check stays good. Default 12h: long enough that
   * a bot restarting all day costs nothing, short enough to notice a trader
   * going quiet. `0` forces a re-check. */
  activityTtlMs?: number;
}

/** Enrich every handle, cheaply by default.
 *
 * A cached trader is used as-is (already paid for). Everything else is checked
 * against `/v2/users/{handle}/trades`, which is served from captured data and
 * costs no wallet resolution. Only `verify: true` spends one of the 25.
 *
 * Anything unresolved comes back copyable with a `warning` - never dropped,
 * because a handle we could not enrich still fires alerts we want to copy. */
export async function resolveFollows(
  fomo: FomoClient,
  follows: Follow[],
  options: ResolveOptions = {},
): Promise<ResolvedFollow[]> {
  const {
    concurrency = 2,
    deadlineMs = 10_000,
    verify = false,
    activityTtlMs = 12 * 3_600_000,
    maxRetries = 0,
  } = options;
  const cacheFile = options.cacheFile ?? TRADER_CACHE_FILE;
  const cache = options.cache ?? loadTraderCache(cacheFile);
  let cacheDirty = false;
  // Unresolved rows keep their place in the list, so the table matches the file.
  const resolved: ResolvedFollow[] = follows.map((follow) => ({
    ...follow,
    ok: true,
    warning: "lookup timed out",
  }));

  const controller = new AbortController();
  let expire: (() => void) | undefined;
  // The deadline both aborts in-flight requests and resolves the pass on its
  // own, so a request that ignores the abort - or an API that simply never
  // answers - still cannot hold up the stream.
  const expired = new Promise<void>((resolve) => {
    expire = resolve;
  });
  const deadline = setTimeout(() => {
    controller.abort();
    expire?.();
  }, deadlineMs);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < follows.length && !controller.signal.aborted) {
      const index = next++;
      const follow = follows[index] as Follow;
      const result = await resolveOne(fomo, follow, {
        cache,
        verify,
        activityTtlMs,
        maxRetries,
        ...(options.budget ? { budget: options.budget } : {}),
        ...(controller.signal ? { signal: controller.signal } : {}),
      });
      if (result.cached) cacheDirty = true;
      resolved[index] = result.follow;
    }
  };

  try {
    await Promise.race([
      Promise.all(Array.from({ length: Math.min(concurrency, follows.length) }, worker)),
      expired,
    ]);
  } finally {
    clearTimeout(deadline);
    expire?.();
    if (cacheDirty) saveTraderCache(cache, cacheFile);
  }
  return resolved;
}

interface ResolveOneOptions {
  cache: Map<string, CachedTrader>;
  verify: boolean;
  activityTtlMs: number;
  maxRetries: number;
  budget?: Budget;
  signal?: AbortSignal;
}

async function resolveOne(
  fomo: FomoClient,
  follow: Follow,
  options: ResolveOneOptions,
): Promise<{ follow: ResolvedFollow; cached: boolean }> {
  const { cache, verify, activityTtlMs, maxRetries, budget, signal } = options;
  const key = normalizeHandle(follow.handle);
  const hit = cache.get(key);

  const merge = (extra: ResolvedFollow): ResolvedFollow =>
    hit?.trader && hit.fetchedAt ? { ...fromTrader(follow, hit.trader, hit.fetchedAt), ...extra } : extra;

  // 1. Everything already on disk is fresh enough: spend nothing at all. This
  //    is the steady state for a bot that restarts, and the reason a restart
  //    loop cannot eat the monthly quota.
  const fresh =
    hit?.activity !== undefined &&
    Date.now() - Date.parse(hit.activity.checkedAt) < activityTtlMs;
  if (!verify && fresh && hit?.activity) {
    return { follow: merge(fromActivity(follow, hit.activity)), cached: false };
  }
  if (!verify && !fresh && hit?.trader && hit.fetchedAt && activityTtlMs === Infinity) {
    return { follow: fromTrader(follow, hit.trader, hit.fetchedAt), cached: false };
  }

  // 2. Spend a wallet resolution only when asked, and only if one is left.
  //    A handle already resolved this month is free to re-resolve.
  if (verify && (!budget || budget.walletsRemaining > 0 || budget.resolved(key))) {
    try {
      const trader: Trader = await fomo.trader(follow.handle, {
        maxRetries,
        ...(signal ? { signal } : {}),
      });
      const fetchedAt = new Date().toISOString();
      cache.set(key, { ...cache.get(key), fetchedAt, trader });
      return { follow: fromTrader(follow, trader, fetchedAt), cached: true };
    } catch (error) {
      if (error instanceof FomoNotFoundError) {
        return { follow: { ...follow, ok: false, reason: "no such handle on FOMO" }, cached: false };
      }
      // Out of resolutions after all: fall through to the free check rather
      // than reporting the trader as broken.
      if (!(error instanceof FomoRateLimitError) && !(error instanceof BudgetError)) {
        const detail = error instanceof Error ? error.message : String(error);
        return { follow: { ...follow, ok: true, warning: `unresolved: ${detail}` }, cached: false };
      }
    }
  }

  // 3. The free path: captured trade history. `available: true` proves the
  //    handle is real and active; `false` is inconclusive (a real trader with
  //    nothing captured looks identical to a typo), so we keep copying and say so.
  try {
    const { available, activeCount, closedCount } = await fomo.trades(follow.handle, {
      limit: 1,
      maxRetries,
      ...(signal ? { signal } : {}),
    });
    const activity: CachedActivity = {
      checkedAt: new Date().toISOString(),
      available,
      ...(activeCount === undefined ? {} : { activeCount }),
      ...(closedCount === undefined ? {} : { closedCount }),
    };
    cache.set(key, { ...cache.get(key), activity });
    // Cached wallets plus a fresh activity count: the best of both.
    return { follow: merge(fromActivity(follow, activity)), cached: true };
  } catch (error) {
    if (error instanceof FomoNotFoundError) {
      return { follow: { ...follow, ok: false, reason: "no such handle on FOMO" }, cached: false };
    }
    if (signal?.aborted) return { follow: { ...follow, ok: true, warning: "lookup timed out" }, cached: false };
    if (hit?.activity) {
      // A stale cache beats no data, and beats blocking the stream on a retry.
      return { follow: merge(fromActivity(follow, hit.activity)), cached: false };
    }
    if (error instanceof BudgetError) {
      return { follow: { ...follow, ok: true, warning: "budget spent - not looked up" }, cached: false };
    }
    if (error instanceof FomoRateLimitError) {
      return { follow: { ...follow, ok: true, warning: "lookup throttled" }, cached: false };
    }
    // The API's auth backend flaps; say so plainly rather than implying the
    // handle is at fault.
    const detail = error instanceof Error ? error.message.replace(/^\w+ \d+ .*?: /, "") : String(error);
    return { follow: { ...follow, ok: true, warning: `lookup failed: ${detail}` }, cached: false };
  }
}

/* ---------------------------------------------------------------- import */

/** Words that show up next to handles when you copy a following list out of
 * the FOMO app, and are never handles themselves. */
const NOISE = new Set([
  "followers", "following", "follow", "followed", "verified", "trader", "traders",
  "pnl", "usd", "vol", "volume", "trades", "holdings", "rank", "you", "and", "fomo",
]);

/** Pull handles out of whatever you paste - one per line, comma-separated, or a
 * screenful copied straight from the app with follower counts interleaved.
 *
 * `@`-prefixed tokens win when the text has any, since that is unambiguous;
 * otherwise each line contributes its first word. */
export function parseHandles(input: string): string[] {
  const tagged = [...input.matchAll(/@([A-Za-z0-9_]{2,32})\b/g)].map((match) => match[1] as string);
  const candidates =
    tagged.length > 0
      ? tagged
      : input
          .split(/[\n,;]+/)
          .map((line) => line.trim().split(/[\s|]+/)[0] ?? "")
          .filter(Boolean);

  const seen = new Set<string>();
  const handles: string[] = [];
  for (const candidate of candidates) {
    const handle = candidate.replace(/^@+/, "").trim();
    const key = handle.toLowerCase();
    // Drop the noise a paste drags along: counts, money, and column headers.
    if (handle.length < 2 || NOISE.has(key) || /^[\d.,$%+-]+[kmb]?$/i.test(handle)) continue;
    if (!/^[A-Za-z0-9_]+$/.test(handle) || seen.has(key)) continue;
    seen.add(key);
    handles.push(handle);
  }
  return handles;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (text += chunk));
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

/* ------------------------------------------------------------ formatting */

const usd = (value: number | undefined): string =>
  value === undefined || value === null ? "-" : `$${Math.round(value).toLocaleString("en-US")}`;

/** Render the resolved list as a fixed-width table for the boot log.
 *
 * `open`/`closed` come from the free endpoint and are the activity signal we
 * can afford every boot; `pnl` only appears for traders whose wallets we have
 * paid to resolve at some point. */
export function formatFollows(rows: ResolvedFollow[]): string {
  const lines = [
    `  ${"handle".padEnd(18)} ${"w".padStart(4)}  ${"open".padStart(5)} ${"closed".padStart(6)}  ` +
      `${"pnl(all)".padStart(12)}  hold    status`,
  ];
  for (const row of rows) {
    const hold = row.avgHoldSeconds ? `${Math.round(row.avgHoldSeconds / 60)}m` : "-";
    const status = !row.ok
      ? `DROP ${row.reason}`
      : row.mute
        ? "muted"
        : row.warning
          ? `copying (${row.warning})`
          : row.verifiedAt
            ? `copying (wallets cached${row.verified ? ", verified pnl" : ""})`
            : "copying";
    lines.push(
      `  @${row.handle.padEnd(17)} ${String(row.weight ?? 1).padStart(4)}  ` +
        `${String(row.activeCount ?? "-").padStart(5)} ${String(row.closedCount ?? "-").padStart(6)}  ` +
        `${usd(row.pnlUsd).padStart(12)}  ${hold.padEnd(6)}  ${status}`,
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------- CLI */

async function cli(argv: string[]): Promise<void> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: fall back to the ambient environment.
  }

  const [command = "list", handleArg] = argv;
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? undefined : argv[at + 1];
  };

  const budget = new Budget();
  const client = (): FomoClient =>
    new FomoClient({ apiKey: process.env["FOMO_API_KEY"], fetch: governedFetch(budget) });

  // Two different lists on purpose: `roster` is what the bot watches (config.ts
  // + file overrides), `follows` is only the file, which is all the mutating
  // commands may touch. Writing the roster back would duplicate it.
  const roster = followRoster();
  const follows = loadFollows();
  const target = handleArg ? normalizeHandle(handleArg) : undefined;
  const at = target ? follows.findIndex((follow) => normalizeHandle(follow.handle) === target) : -1;

  switch (command) {
    case "list": {
      const rows = await resolveFollows(client(), roster, { budget, maxRetries: 2 });
      const overrides = follows.length > 0 ? `, ${follows.length} with overrides in ${FOLLOWS_FILE}` : "";
      console.log(`${roster.length} follow(s) from config.ts${overrides}\n${formatFollows(rows)}`);
      console.log(`\n${formatBudget(budget)}`);
      return;
    }
    case "verify": {
      // The only command that spends the scarce quota, and only on request:
      //   follows verify            - every follow missing cached wallets
      //   follows verify @handle    - just that one
      const cached = loadTraderCache();
      const pending = (handleArg ? [{ handle: handleArg }] : roster).filter(
        (follow) => cached.get(normalizeHandle(follow.handle))?.trader === undefined,
      );
      if (pending.length === 0) {
        console.log(`Every follow already has cached wallets - nothing to spend.\n${formatBudget(budget)}`);
        return;
      }
      const left = budget.walletsRemaining;
      console.log(
        `Resolving ${Math.min(pending.length, left)} of ${pending.length} handle(s); ` +
          `${left} wallet resolution(s) left this month.`,
      );
      if (left === 0) {
        console.log("None left - they come back on the 1st UTC. Cached traders and the stream are unaffected.");
        return;
      }
      const rows = await resolveFollows(client(), pending.slice(0, left), {
        budget,
        verify: true,
        deadlineMs: 60_000,
        maxRetries: 2,
      });
      console.log(formatFollows(rows));
      console.log(`\n${formatBudget(budget)}`);
      return;
    }
    case "usage": {
      console.log(formatBudget(budget));
      return;
    }
    case "add": {
      if (!handleArg) throw new Error("usage: add <handle> [--weight n] [--max usd] [--note text]");
      if (normalizeHandle(handleArg) === normalizeHandle(MY_HANDLE)) {
        throw new Error(`@${MY_HANDLE} is you - copying your own fills is a feedback loop`);
      }
      const [checked] = await resolveFollows(client(), [{ handle: handleArg }], { budget, maxRetries: 2 });
      const resolved = checked as ResolvedFollow;
      if (!resolved.ok) throw new Error(`cannot add @${handleArg}: ${resolved.reason}`);

      if (FOLLOWING.some((handle) => normalizeHandle(handle) === target) && at === -1) {
        console.log(`@${resolved.handle} is already in the config.ts roster - writing per-trader settings only.`);
      }
      const weight = flag("weight");
      const maxUsd = flag("max");
      const entry: Follow = {
        handle: resolved.handle,
        ...(weight ? { weight: Number(weight) } : {}),
        ...(maxUsd ? { maxUsd: Number(maxUsd) } : {}),
        ...(flag("note") ? { note: flag("note") as string } : {}),
      };
      if (at === -1) follows.push(entry);
      else follows[at] = { ...follows[at], ...entry };
      saveFollows(follows);
      console.log(`${at === -1 ? "added" : "updated"} @${resolved.handle} (${formatFollows([resolved]).split("\n")[1]?.trim()})`);
      return;
    }
    case "import": {
      // FOMO cannot tell us who you follow, so the app's list comes in by hand:
      //   npx tsx src/follows.ts import following.txt
      //   pbpaste | npx tsx src/follows.ts import
      const text = handleArg && !handleArg.startsWith("--")
        ? readFileSync(handleArg, "utf8")
        : await readStdin();
      const handles = parseHandles(text);
      if (handles.length === 0) throw new Error("No handles found - paste one per line, or @handle anywhere in the text");

      const self = normalizeHandle(MY_HANDLE);
      const weight = flag("weight");

      console.log(
        `Found ${handles.length} handle(s); checking them against captured trade history ` +
          `(no wallet resolutions spent)...`,
      );
      const checked = await resolveFollows(
        client(),
        handles.map((handle) => ({ handle })),
        { budget, deadlineMs: 120_000, maxRetries: 2 },
      );

      // Anything already on the roster - hardcoded or in the file - is "already".
      const existing = new Set(roster.map((follow) => normalizeHandle(follow.handle)));
      const added: string[] = [];
      // Copied but unproven: `/trades` answers the same way for a typo and for
      // a real trader FOMO has not captured yet, so these need your eyes.
      const unproven = new Map<string, string[]>();
      const known: string[] = [];
      const unknown: string[] = [];
      const skippedSelf: string[] = [];

      for (const row of checked) {
        const key = normalizeHandle(row.handle);
        if (!row.ok) {
          unknown.push(row.handle);
          continue;
        }
        // Copying your own trades is a feedback loop, not a strategy.
        if (key === self) {
          skippedSelf.push(row.handle);
          continue;
        }
        if (existing.has(key)) {
          known.push(row.handle);
          continue;
        }
        follows.push({ handle: row.handle, ...(weight ? { weight: Number(weight) } : {}) });
        existing.add(key);
        added.push(row.handle);
        if (row.warning) unproven.set(row.warning, [...(unproven.get(row.warning) ?? []), row.handle]);
      }

      saveFollows(follows);
      const list = (handles: string[]): string => handles.map((handle) => `@${handle}`).join(", ");
      const flagged = new Set([...unproven.values()].flat());
      const confirmed = added.filter((handle) => !flagged.has(handle));
      console.log(`\nadded     ${added.length}`);
      if (confirmed.length) console.log(`  active  ${confirmed.length}: ${list(confirmed)}`);
      for (const [warning, group] of unproven) {
        console.log(`  ${warning}: ${list(group)}`);
      }
      if (unproven.has("no captured trades - unverified")) {
        console.log(
          `\n  "no captured trades" reads the same for a quiet trader and for a typo -\n` +
            `  the API cannot tell them apart. They stay on the list and will copy if they\n` +
            `  ever fire; drop the ones you mistyped with: npm run follows -- remove <handle>`,
        );
      }
      if (known.length) console.log(`already   ${known.length}: ${list(known)}`);
      if (skippedSelf.length) console.log(`skipped   you (@${skippedSelf[0]})`);
      if (unknown.length) console.log(`rejected  ${unknown.length}: ${list(unknown)} - no such handle on FOMO`);
      console.log(`\n${follows.length} follow(s) in ${FOLLOWS_FILE}\n${formatBudget(budget)}`);
      return;
    }
    case "remove": {
      if (at === -1) {
        if (FOLLOWING.some((handle) => normalizeHandle(handle) === target)) {
          throw new Error(
            `@${handleArg} is hardcoded in src/config.ts - delete the line there, ` +
              `or keep the row and stop copying it with: mute ${handleArg}`,
          );
        }
        throw new Error(`@${handleArg} is not on the follow list`);
      }
      const [removed] = follows.splice(at, 1);
      saveFollows(follows);
      console.log(`removed @${removed?.handle}`);
      return;
    }
    case "mute":
    case "unmute": {
      const onRoster = roster.find((follow) => normalizeHandle(follow.handle) === target);
      if (at === -1 && !onRoster) throw new Error(`@${handleArg} is not on the follow list`);
      // A hardcoded handle has no file row yet: mute writes the override.
      if (at === -1) follows.push({ handle: onRoster?.handle ?? (handleArg as string), mute: command === "mute" });
      else follows[at] = { ...(follows[at] as Follow), mute: command === "mute" };
      saveFollows(follows);
      console.log(`${command}d @${(at === -1 ? follows[follows.length - 1] : follows[at])?.handle}`);
      return;
    }
    default:
      throw new Error(
        `unknown command "${command}" - try list | add | import | verify | usage | remove | mute | unmute`,
      );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await cli(process.argv.slice(2));
}
