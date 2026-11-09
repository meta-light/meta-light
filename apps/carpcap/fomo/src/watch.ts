/* Monitor, not a bot: print what the accounts you follow are doing, and decide
 * for yourself. No sizing, no risk rules, no positions, nothing suppressed.
 *
 *   npm run watch                      # your follows, live
 *   npm run watch -- --recent 5        # each account's last 5 trades, then live
 *   npm run watch -- --history 100     # the feed's last 100 alerts, then live
 *   npm run watch -- --all             # the whole firehose, not just yours
 *   npm run watch -- --kind buy,sell   # only these alert kinds
 *   npm run watch -- --min 5000        # only trades over $5k
 *   npm run watch -- --verbose         # include each alert's own wording
 *
 * The socket is free: watching costs no requests once the roster is loaded. */
import { FomoClient, FomoAuthError, alertKind, type Alert } from "./fomo.ts";
import { formatFollows, followRoster, normalizeHandle, resolveFollows, FOLLOWS_FILE } from "./follows.ts";
import { Budget, BudgetError, governedFetch, formatBudget } from "./budget.ts";
import { MY_HANDLE } from "./config.ts";
import dotenv from "dotenv";
dotenv.config();

const argv = process.argv.slice(2);
const args = new Set(argv);
const verbose = args.has("--verbose");
const watchAll = args.has("--all");
const value = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};
const number = (name: string, fallback: number): number => {
  const parsed = Number(value(name));
  return Number.isFinite(parsed) ? parsed : fallback;
};

// `/alerts` returns at most 100 per call and takes no "before" cursor, so 100
// is the whole of the available history, not a page of it.
const HISTORY_MAX = 100;
const historyAsked = number("history", 0);
const history = Math.min(Math.max(0, Math.trunc(historyAsked)), HISTORY_MAX);
const minUsd = number("min", 0);
const recent = Math.max(0, Math.trunc(number("recent", 0)));
const kinds = new Set(
  (value("kind") ?? "")
    .split(",")
    .map((kind) => kind.trim().toLowerCase())
    .filter(Boolean),
);

const apiKey = process.env["FOMO_API_KEY"];
if (!apiKey) throw new Error("Set FOMO_API_KEY (free key at https://fomoapi.io/dashboard)");

const budget = new Budget();
const fomo = new FomoClient({ apiKey, skipReplay: true, fetch: governedFetch(budget) });

const follows = followRoster();
if (follows.length === 0 && !watchAll) {
  throw new Error(
    `Nothing in the FOLLOWING list.\n\n` +
      `FOMO's API is keyed to an API key, not to your account: there is no endpoint\n` +
      `that returns who @${MY_HANDLE} follows. The roster is hardcoded - add handles to\n` +
      `FOLLOWING in src/config.ts (or bulk-parse a paste of the app's list with\n` +
      `\`pbpaste | npm run follows -- import\`, which writes ${FOLLOWS_FILE}).\n` +
      `\nOr watch the whole firehose instead:  npm run watch -- --all\n`,
  );
}

console.log(`You: @${MY_HANDLE}  |  ${formatBudget(budget)}`);

// Muting is a copy-trading instruction, not a monitoring one: a muted account
// is still worth seeing, it is just not worth following into a position.
const watching = new Set<string>();
if (!watchAll) {
  const resolved = await resolveFollows(fomo, follows, { budget }).catch((error: unknown) => {
    if (error instanceof FomoAuthError) throw new Error("Key rejected - check FOMO_API_KEY");
    if (error instanceof BudgetError) {
      console.log(`  ${error.message}\n  Watching unenriched - the stream is unaffected.`);
      return follows.map((follow) => ({ ...follow, ok: true }));
    }
    throw error;
  });
  for (const row of resolved) if (row.ok) watching.add(normalizeHandle(row.handle));
  console.log(`\nWatching ${watching.size} of ${resolved.length} account(s) from src/config.ts`);
  console.log(formatFollows(resolved));
  if (watching.size === 0) throw new Error("Nothing to watch");
}

const seen = new Set<string>();
const counts = new Map<string, number>();
const kindCounts = new Map<string, number>();
let shown = 0;
let hidden = 0;

/** Every filter lives here, so the tally at exit can be trusted. */
function show(alert: Alert, replayed = false): void {
  const key = alert.eventId ?? alert.id;
  if (key) {
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 5_000) seen.delete(seen.values().next().value as string);
  }

  const handle = alert.trader ? normalizeHandle(alert.trader) : undefined;
  if (!watchAll && (!handle || !watching.has(handle))) return;

  const kind = alertKind(alert) ?? "alert";
  if (kinds.size > 0 && !kinds.has(kind)) {
    hidden += 1;
    return;
  }
  const usd = alert.usdValue ?? 0;
  if (minUsd > 0 && usd < minUsd) {
    hidden += 1;
    return;
  }

  shown += 1;
  if (handle) counts.set(handle, (counts.get(handle) ?? 0) + 1);
  kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);

  const size = usd > 0 ? `$${Math.round(usd).toLocaleString("en-US")}` : "";
  const token = alert.token ?? "?";
  const where = alert.chain ?? alert.chainId ?? "?";
  const age = Math.round((Date.now() - alert.ts) / 1000);
  console.log(
    `${replayed ? " " : ""}${stamp(alert.ts)} ${kind.toUpperCase().padEnd(6)} @${(alert.trader ?? "?").padEnd(18)} ` +
      `${size.padStart(10)}  ${token} on ${where}${age > 90 ? `  (${age}s ago)` : ""}`,
  );
  if (alert.tokenAddress) console.log(`                  ${alert.tokenAddress}`);
  // A buy's own wording just restates the fields above; a thesis IS the wording.
  const restates = kind === "buy" || kind === "sell" || kind === "trade";
  if (alert.text && (verbose || !restates)) console.log(`                  "${alert.text.trim()}"`);
}

/* Per-account history, which is what a quiet roster actually needs. `/alerts`
 * is one global firehose - its last 100 rows can be four minutes of a busy
 * market and contain nothing from your six accounts. `/trades` is per handle,
 * costs no wallet resolution, and reaches back through their whole captured
 * history. */
if (recent > 0 && !watchAll) {
  console.log(`\nLast ${recent} captured trade(s) per account`);
  for (const follow of follows) {
    const { available, trades } = await fomo
      .trades(follow.handle, { limit: recent })
      .catch((error: unknown) => {
        console.log(`\n@${follow.handle}\n  lookup failed: ${error instanceof Error ? error.message : String(error)}`);
        return { available: false, trades: [] };
      });
    if (!available || trades.length === 0) {
      console.log(`\n@${follow.handle}\n  nothing captured`);
      continue;
    }
    console.log(`\n@${follow.handle}`);
    for (const trade of trades) {
      const pnl = trade.realizedPnlUsd ?? trade.unrealizedPnlUsd;
      // Open positions come back without a timestamp or a USD size, so every
      // column has to survive being absent rather than printing "?".
      const when = trade.ts ? new Date(trade.ts).toISOString().slice(0, 16).replace("T", " ") : "-";
      const size = trade.sizeUsd ? `$${Math.round(trade.sizeUsd).toLocaleString("en-US")}` : "-";
      // Feed rows carry a side and a timestamp; captured positions carry a
      // status and neither. One column, whichever the row actually has.
      const what = trade.side ?? trade.status ?? "-";
      console.log(
        (
          `  ${when.padEnd(16)}  ${what.padEnd(4)} ${(trade.token?.symbol ?? "?").padEnd(10)} ` +
          `${size.padStart(10)}  ${(trade.chain ?? trade.chainId ?? "-").toString().padEnd(10)} ` +
          `${pnl === undefined ? "" : `pnl $${Math.round(pnl).toLocaleString("en-US")}`}`
        ).trimEnd(),
      );
    }
  }
  console.log("");
}

if (history > 0) {
  // One request per 100 alerts, so this is opt-in rather than the default.
  if (historyAsked > HISTORY_MAX) {
    console.log(`\n(--history ${historyAsked} clamped to ${HISTORY_MAX}: that is all /alerts will return.)`);
  }
  const { alerts, available } = await fomo.alerts({ limit: history });
  if (!available) console.log("\nNo alert history available.");
  else {
    console.log(`\nLast ${alerts.length} alert(s)\n`);
    for (const alert of [...alerts].reverse()) show(alert, true);
    if (shown === 0) console.log("  (none from the accounts you follow)");
  }
}

// One unfiltered connection: the roster filter lives in show(), so --all and a
// follow list share exactly one code path.
const stream = fomo.stream();

/* The welcome frame is the only place the feed's delay is stated, and it is
 * re-sent on every reconnect. A delay is not fatal for monitoring the way it is
 * for copying - you just want to know you are reading the past. */
let announced: string | undefined;
fomo.on("welcome", (welcome) => {
  const delay = welcome.delaySeconds ?? 0;
  const state = welcome.realtime ? "realtime" : `delayed ${delay}s`;
  if (state === announced) return; // reconnects are routine; changes are not
  const first = announced === undefined;
  announced = state;
  const prefix = first ? "\n" : `\n${stamp(Date.now())} feed changed: `;
  if (welcome.realtime) {
    console.log(`${prefix}Live${first ? ` - watching ${watchAll ? "every trader" : `${watching.size} account(s)`}, ctrl-c to stop` : ""}\n`);
  } else {
    const keyless = /keyless/i.test(welcome.note ?? "");
    console.log(
      `${prefix}Live, but ${delay}s behind${keyless ? " - the socket is serving the KEYLESS demo feed" : ""}.` +
        (keyless ? `\nThat is what FOMO returns while its auth backend is down; your key is fine.` : "") +
        `\nFine for watching. Not fine for copying.\n`,
    );
  }
});

await fomo.welcome().catch((error: unknown) => {
  console.error(`  no welcome frame: ${error instanceof Error ? error.message : String(error)}`);
});

fomo.on("error", (error) => console.error(`  stream error: ${error.message}`));
fomo.on("reconnecting", ({ attempt, delayMs }) => console.log(`  reconnecting (#${attempt} in ${delayMs}ms)`));

process.on("SIGINT", () => {
  console.log("\n");
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const byKind = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]).map(([kind, n]) => `${kind} ${n}`);
  console.log(`Showed ${shown} alert(s)${hidden > 0 ? `, filtered out ${hidden}` : ""}: ${byKind.join(", ") || "none"}`);
  for (const [handle, count] of busiest) console.log(`  @${handle.padEnd(20)} ${count}`);
  console.log(formatBudget(budget));
  fomo.disconnect();
  process.exit(0);
});

for await (const alert of stream) show(alert as Alert);

function stamp(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}
