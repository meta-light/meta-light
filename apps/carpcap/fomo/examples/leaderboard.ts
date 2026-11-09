/* Keyless discovery: the ranked leaderboard and the trending token board.
 *
 *   npx tsx examples/leaderboard.ts
 *
 * No API key needed - /v1, /health, /v2/leaderboard/{window} and /v2/alerts are
 * the public tier. Everything else needs `FOMO_API_KEY`. */
import { FomoAuthError, FomoClient } from "../src/fomo.ts";

const fomo = new FomoClient({ apiKey: process.env["FOMO_API_KEY"] });

const { window, capturedAt, traders } = await fomo.leaderboard("24h", { limit: 5 });
console.log(`Top traders (${window}, captured ${capturedAt ?? "n/a"})`);
for (const trader of traders) {
  const usd = Math.round(trader.pnlUsd).toLocaleString("en-US");
  console.log(
    `  #${trader.rank} ${trader.handle.padEnd(20)} $${usd.padStart(10)}  ` +
      `sol:${trader.wallets?.solana?.slice(0, 6) ?? "-"} evm:${trader.wallets?.evm?.slice(0, 8) ?? "-"}`,
  );
}

// Token boards are keyed-only, unlike the trader leaderboard above.
const board = await fomo.trending({ limit: 5 }).catch((error) => {
  if (error instanceof FomoAuthError) return undefined;
  throw error;
});
if (!board) {
  console.log("\nToken boards need an API key - set FOMO_API_KEY (https://fomoapi.io/dashboard).");
} else if (!board.available) {
  console.log("\nTrending board has not been captured yet.");
} else {
  console.log(`\nTrending tokens (captured ${board.capturedAt ?? "n/a"})`);
  for (const row of board.tokens) {
    const mcap = row.marketCapUsd ? `$${Math.round(row.marketCapUsd).toLocaleString("en-US")}` : "-";
    console.log(
      `  #${row.rank} ${(row.token?.symbol ?? "?").padEnd(12)} ${row.network ?? "?"}  ` +
        `mcap ${mcap}  buyers ${row.fomoBuyers ?? 0}  24h ${row.change24h ?? 0}%`,
    );
  }
}

console.log("\nrate limit:", fomo.rateLimit);
