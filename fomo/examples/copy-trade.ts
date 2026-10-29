/* The copy-trading pipeline, end to end:
 *
 *   leaderboard -> whose trades to copy
 *   trades       -> how they entered and exited
 *   balances     -> what to mirror right now
 *   ws/alerts    -> act the moment they trade
 *
 *   FOMO_API_KEY=... npx tsx examples/copy-trade.ts [handle]
 *
 * Requires a key: trades, balances and the trader endpoint are keyed-only. */
import { FomoClient, FomoAuthError, alertKind } from "../src/fomo.ts";

const apiKey = process.env["FOMO_API_KEY"];
if (!apiKey) throw new Error("Set FOMO_API_KEY (free key at https://fomoapi.io/dashboard)");

// skipReplay drops the backlog the socket sends on connect, so the stream
// below only yields genuinely new trades.
const fomo = new FomoClient({ apiKey, skipReplay: true });

// 1. Pick a trader: the argument, or the top of the 24h board.
let handle = process.argv[2];
if (!handle) {
  const { traders } = await fomo.leaderboard("24h", { limit: 1 });
  handle = traders[0]?.handle;
  if (!handle) throw new Error("Leaderboard is empty");
}

const trader = await fomo.trader(handle).catch((error) => {
  if (error instanceof FomoAuthError) throw new Error("Key rejected - check FOMO_API_KEY");
  throw error;
});
console.log(`${trader.displayName ?? trader.handle} (@${trader.handle})`);
console.log(`  verified: ${trader.verified ?? false}  followers: ${trader.followers ?? 0}`);
console.log(`  wallets:  sol ${trader.wallets?.solana ?? "-"}`);
console.log(`            evm ${trader.wallets?.evm ?? "-"}`);
console.log(`  pnl:      24h $${trader.pnl?.["24h"] ?? 0}  all $${trader.pnlUsd ?? 0}`);
const ageDays = trader.accountAgeDays ?? trader.profile?.accountAgeDays;
console.log(`  account:  ${ageDays ?? "?"} days old`);

// 2. Evaluate their entries and exits.
const { available: tradesAvailable, trades } = await fomo.trades(handle, { limit: 5 });
if (!tradesAvailable) {
  console.log("\nNo captured trade history for this trader yet.");
} else {
  console.log("\nRecent trades");
  for (const trade of trades) {
    const pnl = trade.realizedPnlUsd ?? trade.unrealizedPnlUsd ?? 0;
    console.log(
      `  ${(trade.side ?? trade.status ?? "?").padEnd(6)} ${(trade.token?.symbol ?? "?").padEnd(12)} ` +
        `${trade.chain ?? trade.chainId ?? "?"}  entry ${trade.avgEntryPrice ?? "-"}  ` +
        `exit ${trade.avgExitPrice ?? "-"}  pnl $${Math.round(pnl)}`,
    );
  }

  // Any captured trade can be expanded into its onchain legs.
  const withId = trades.find((trade) => trade.tradeId);
  if (withId?.tradeId) {
    const detail = await fomo.trade(withId.tradeId);
    console.log(
      `  detail ${withId.tradeId}: ${detail.swaps?.length ?? 0} swaps, ` +
        `${detail.transfers?.length ?? 0} transfers, isDev ${detail.isDev ?? false}`,
    );
  }
}

// 3. Mirror the live portfolio.
const balances = await fomo.balances(handle);
if (!balances.available) {
  console.log("\nNo captured portfolio for this trader yet.");
} else {
  console.log(`\nPortfolio: $${Math.round(balances.totalValueUsd ?? 0).toLocaleString("en-US")}`);
  for (const holding of balances.holdings.slice(0, 8)) {
    console.log(
      `  ${(holding.token?.symbol ?? "?").padEnd(12)} $${Math.round(holding.valueUsd ?? 0)
        .toString()
        .padStart(9)}  24h ${holding.change24h ?? 0}%`,
    );
  }
}

// 4. Act the moment they trade.
console.log(`\nStreaming @${handle} - ctrl-c to stop`);
const alerts = fomo.stream({ trader: handle });
const { realtime, delaySeconds } = await fomo.welcome();
console.log(`  realtime: ${realtime ?? false}${realtime ? "" : ` (delayed ${delaySeconds ?? 0}s)`}`);

process.on("SIGINT", () => {
  fomo.disconnect();
  process.exit(0);
});

for await (const alert of alerts) {
  console.log(`  ${alertKind(alert)} ${alert.token} on ${alert.chain} - ${alert.text}`);
}
