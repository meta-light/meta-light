/* Token-first research: who holds a coin, and why they say they bought it.
 *
 *   FOMO_API_KEY=... npx tsx examples/smart-money.ts PONS
 */
import { FomoClient } from "../src/fomo.ts";

const apiKey = process.env["FOMO_API_KEY"];
if (!apiKey) throw new Error("Set FOMO_API_KEY (free key at https://fomoapi.io/dashboard)");

const fomo = new FomoClient({ apiKey });
const query = process.argv[2] ?? "PONS";

// Resolve a symbol to a contract address.
const { tokens } = await fomo.searchTokens(query, { limit: 1 });
const token = tokens[0];
if (!token?.address) throw new Error(`No token matched "${query}"`);
console.log(`${token.symbol} - ${token.name ?? ""} (${token.address})`);
console.log(`  market cap: $${Math.round(token.marketCapUsd ?? 0).toLocaleString("en-US")}`);

// Which tracked traders hold it: a smart-money signal, not an anonymous list.
const { available: holdersAvailable, holders } = await fomo.holders(token.address, { limit: 10 });
if (!holdersAvailable) {
  console.log("\nNo captured holders for this token yet.");
} else {
  console.log("\nTracked holders");
  for (const holder of holders) {
    console.log(`  @${holder.handle.padEnd(20)} $${Math.round(holder.valueUsd ?? 0).toLocaleString("en-US")}`);
  }
}

// The reasoning behind the trades.
const { available: thesesAvailable, theses } = await fomo.tokenTheses(token.address, { limit: 5 });
if (!thesesAvailable) {
  console.log("\nNo theses captured for this token yet.");
} else {
  console.log("\nTheses");
  for (const thesis of theses) {
    const equity = thesis.equity ? ` [$${Math.round(thesis.equity).toLocaleString("en-US")} position]` : "";
    console.log(`  @${thesis.handle ?? "?"}${thesis.isDev ? " (dev)" : ""}${equity}: ${thesis.text}`);
  }
}
