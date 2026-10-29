import { FomoClient, FomoAuthError, type Alert } from "./fomo.ts";
import { formatFollows, followRoster, normalizeHandle, resolveFollows, FOLLOWS_FILE } from "./follows.ts";
import { SignalEngine, type CopySignal, type Skip } from "./signals.ts";
import { Budget, BudgetError, governedFetch, formatBudget } from "./budget.ts";
import { MY_HANDLE } from "./config.ts";
import dotenv from "dotenv";
dotenv.config();

const argv = process.argv.slice(2);
const args = new Set(argv);
const verbose = args.has("--verbose");
const backfill = args.has("--backfill");
const flag = (name: string, fallback: number): number => {
  const at = argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : Number(argv[at + 1]);
  return value === undefined || Number.isNaN(value) ? fallback : value;
};

const apiKey = process.env["FOMO_API_KEY"];
if (!apiKey) throw new Error("Set FOMO_API_KEY (free key at https://fomoapi.io/dashboard)");

// Every REST call in this process goes through the ledger, retries included,
// so a 24/7 run can never quietly overrun the month. The socket is free.
const budget = new Budget();
const fomo = new FomoClient({ apiKey, skipReplay: true, fetch: governedFetch(budget) });

const follows = followRoster();
if (follows.length === 0) {
  throw new Error(
    `Nothing in the FOLLOWING list.\n\n` +
      `FOMO's API is keyed to an API key, not to your account: there is no endpoint\n` +
      `that returns who @${MY_HANDLE} follows. The roster is hardcoded - add handles to\n` +
      `FOLLOWING in src/config.ts (or bulk-parse a paste of the app's list with\n` +
      `\`pbpaste | npm run follows -- import\`, which writes ${FOLLOWS_FILE}).\n`,
  );
}

console.log(`You: @${MY_HANDLE}  |  ${formatBudget(budget)}`);

const resolved = await resolveFollows(fomo, follows, { budget }).catch((error: unknown) => {
  if (error instanceof FomoAuthError) throw new Error("Key rejected - check FOMO_API_KEY");
  // A spent budget must not stop the bot: the stream costs nothing.
  if (error instanceof BudgetError) {
    console.log(`  ${error.message}\n  Booting unenriched - the stream is unaffected.`);
    return follows.map((follow) => ({ ...follow, ok: true, warning: "budget spent - not looked up" }));
  }
  throw error;
});

const live = resolved.filter((row) => row.ok && !row.mute);
console.log(`\nCopying ${live.length} of ${resolved.length} account(s) from src/config.ts`);
console.log(formatFollows(resolved));
const broken = resolved.filter((row) => !row.ok);
if (broken.length > 0) {
  console.log(`\n${broken.length} handle(s) do not exist on FOMO and will never fire - fix or remove them.`);
}
if (live.length === 0) throw new Error("Nothing to copy");

const engine = new SignalEngine(
  live,
  {
    baseUsd: flag("base", 50),
    maxUsd: flag("max", 250),
    dailyUsdCap: flag("daily", 1000),
    maxAgeMs: flag("max-age", 45) * 1000,
  },
);

engine.on("signal", (signal: CopySignal) => {
  const arrow = signal.side === "buy" ? "BUY " : "SELL";
  const theirs = signal.traderUsd ? ` (they did $${Math.round(signal.traderUsd).toLocaleString("en-US")})` : "";
  console.log(
    `\n${stamp(signal.ts)} ${arrow} $${signal.usd} ${signal.token} on ${signal.chain}` +
      `\n     from @${signal.trader}${theirs} - ${signal.sizing}` +
      `\n     ${signal.tokenAddress}  ${Math.round(signal.ageMs / 1000)}s old  [dry run]`,
  );
  const { spent, remaining } = engine.budget;
  console.log(`     budget: $${spent} spent today, $${remaining} left | ${engine.openPositions.length} open`);
});

const skips = new Map<string, number>();
engine.on("skip", (skip: Skip) => {
  skips.set(skip.reason, (skips.get(skip.reason) ?? 0) + 1);
  if (verbose) console.log(`  · skip ${skip.reason}${skip.detail ? `: ${skip.detail}` : ""}`);
});

if (backfill) {
  // One request per 100 alerts. Cheap, but not free - so it is opt-in.
  const { alerts } = await fomo.alerts({ limit: 100 });
  console.log(`\nReplaying ${alerts.length} recent alert(s) through the engine\n`);
  for (const alert of [...alerts].reverse()) engine.handle(alert);
  report();
  process.exit(0);
}

const stream = fomo.stream();

/* The socket answers a welcome frame on every connection, and it is the only
 * place the feed's delay is stated. Two things make this worth watching for
 * the life of the process rather than reading once at boot:
 *
 *   - a free key is realtime for its first 24h, then 15s delayed;
 *   - while FOMO's auth backend is down the socket ignores the key entirely
 *     and serves the keyless 60s demo feed, which looks identical apart from
 *     this frame. Everything then arrives older than maxAgeMs and is skipped
 *     as stale, so a silent downgrade looks exactly like a quiet market. */
const maxAgeSeconds = Math.round(engine.config.maxAgeMs / 1000);
let announced: string | undefined;

fomo.on("welcome", (welcome) => {
  const delay = welcome.delaySeconds ?? 0;
  const state = `${welcome.realtime ? "realtime" : `delayed ${delay}s`}`;
  if (state === announced) return; // reconnects are routine; changes are not
  const first = announced === undefined;
  announced = state;

  if (welcome.realtime) {
    console.log(
      `${first ? "\n" : `\n${stamp(Date.now())} feed restored: `}Realtime stream open. ` +
        `Watching ${live.length} account(s) - ctrl-c to stop.\n` +
        `The socket carries every alert on one connection, so steady-state REST usage is zero.\n`,
    );
    return;
  }

  const keyless = /keyless/i.test(welcome.note ?? "");
  console.log(
    `\n${first ? "" : `${stamp(Date.now())} `}WARNING: the feed is delayed ${delay}s, not realtime.\n` +
      (keyless
        ? `The socket is serving the KEYLESS demo feed - your key is not being honoured.\n` +
          `That is what FOMO's auth backend returns while it is down (REST 503s too).\n`
        : `A free key is realtime for its first 24h, then delayed. This key is past that.\n`) +
      `Alerts arrive ${delay}s old, so every one exceeds maxAgeMs (${maxAgeSeconds}s) and is\n` +
      `skipped as stale - which looks exactly like a quiet market.\n` +
      `  npm run bot -- --max-age ${delay + 15}   # copy anyway, ${delay}s behind\n`,
  );
});

// Surface the first frame's verdict before the loop starts, so a downgrade is
// never discovered halfway down a log.
await fomo.welcome().catch((error: unknown) => {
  console.error(`  no welcome frame: ${error instanceof Error ? error.message : String(error)}`);
});

fomo.on("error", (error) => console.error(`  stream error: ${error.message}`));
fomo.on("reconnecting", ({ attempt, delayMs }) => console.log(`  reconnecting (#${attempt} in ${delayMs}ms)`));

process.on("SIGINT", () => {
  console.log("\n");
  report();
  fomo.disconnect();
  process.exit(0);
});

for await (const alert of stream) {
  engine.handle(alert as Alert);
}

function report(): void {
  const total = [...skips.values()].reduce((sum, count) => sum + count, 0);
  const tally = [...skips.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => `${reason} ${count}`);
  console.log(`Seen ${total} alert(s): ${tally.join(", ") || "none"}`);
  console.log(`Open positions: ${engine.openPositions.length} | spent today: $${engine.budget.spent}`);
  console.log(formatBudget(budget));
  if (engine.openPositions.length > 0) {
    for (const position of engine.openPositions) {
      console.log(`  ${position.token.padEnd(12)} $${position.usd} on ${position.chain} via @${position.trader}`);
    }
  }
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}
