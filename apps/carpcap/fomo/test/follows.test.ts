/* The follow list and, more importantly, what it costs to load.
 *
 * At 25 wallet resolutions a month, a bot that re-resolved its follows on
 * every restart would be dry inside a day - so the request count is part of
 * the contract here, not an implementation detail. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FomoClient } from "../src/fomo.ts";
import type { FetchLike } from "../src/fomo.ts";
import { Budget } from "../src/budget.ts";
import { PLAN } from "../src/config.ts";
import { loadFollows, normalizeHandle, parseHandles, resolveFollows } from "../src/follows.ts";

const cacheFile = (): string => join(mkdtempSync(join(tmpdir(), "fomo-follows-")), "traders.json");
const ledgerFile = (): string => join(mkdtempSync(join(tmpdir(), "fomo-ledger-")), "usage.json");

/** A client whose every response is chosen by path, with the URLs recorded. */
function client(responses: Record<string, unknown>) {
  const urls: string[] = [];
  const fetch: FetchLike = async (url) => {
    urls.push(url);
    const match = Object.keys(responses).find((key) => url.includes(key));
    const body = match ? responses[match] : { error: "not found" };
    return new Response(JSON.stringify(body), {
      status: match ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  };
  const budget = new Budget({ file: ledgerFile(), now: () => Date.UTC(2026, 8, 2, 12) });
  return { fomo: new FomoClient({ apiKey: "k", fetch: budget.wrap(fetch) }), urls, budget };
}

const TRADES = {
  "/trades": { key: "unipcs", kind: "trades", available: true, activeCount: 63, closedCount: 102, trades: [] },
};

/* ------------------------------------------------------------------ paste */

test("a pasted list of @handles is read in order, once each", () => {
  assert.deepEqual(parseHandles("@CryptoKaleo\n@unipcs\n@CryptoKaleo\n"), ["CryptoKaleo", "unipcs"]);
});

test("handles come out of a screenful copied from the app", () => {
  const pasted = `
    @CryptoKaleo
    Kaleo
    405K followers
    @unipcs · Bonk Guy
    1.2M followers · $4,200,000 PnL
    @EarlyBurry
  `;
  assert.deepEqual(parseHandles(pasted), ["CryptoKaleo", "unipcs", "EarlyBurry"]);
});

test("bare handles work when nothing carries an @", () => {
  assert.deepEqual(parseHandles("CryptoKaleo, unipcs; EarlyBurry\nprevaile"), [
    "CryptoKaleo",
    "unipcs",
    "EarlyBurry",
    "prevaile",
  ]);
});

test("counts, money and column headers are not handles", () => {
  assert.deepEqual(parseHandles("followers\n405K\n$4,200,000\n+18%\nverified\nreal_one"), ["real_one"]);
});

test("an @handle anywhere in a line still counts", () => {
  assert.deepEqual(parseHandles("you follow @kaleo and @unipcs on fomo"), ["kaleo", "unipcs"]);
});

test("a paste with nothing usable yields nothing rather than junk", () => {
  assert.deepEqual(parseHandles("   \n\n , ; \n"), []);
});

/* -------------------------------------------------------------- the ledger */

test("a cold boot costs one free request per follow and no resolutions", async () => {
  const { fomo, urls, budget } = client(TRADES);
  const rows = await resolveFollows(fomo, [{ handle: "unipcs" }, { handle: "kaleo" }], {
    budget,
    cacheFile: cacheFile(),
  });
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes("/trades")), "the profile endpoint must not be touched");
  assert.equal(budget.snapshot().wallets, 0, "a boot must never spend a wallet resolution");
  assert.equal(rows[0]?.activeCount, 63);
  assert.equal(rows[0]?.closedCount, 102);
  assert.ok(rows.every((row) => row.ok));
});

test("a restart inside the TTL costs nothing at all", async () => {
  const file = cacheFile();
  const follows = [{ handle: "unipcs" }];
  const first = client(TRADES);
  await resolveFollows(first.fomo, follows, { budget: first.budget, cacheFile: file });
  assert.equal(first.urls.length, 1);

  const second = client(TRADES);
  const rows = await resolveFollows(second.fomo, follows, { budget: second.budget, cacheFile: file });
  assert.equal(second.urls.length, 0, "a warm cache means a free restart");
  assert.equal(second.budget.snapshot().requests, 0);
  assert.equal(rows[0]?.activeCount, 63, "and the enrichment is still there");
});

test("an expired TTL re-checks, still without a resolution", async () => {
  const file = cacheFile();
  const follows = [{ handle: "unipcs" }];
  const first = client(TRADES);
  await resolveFollows(first.fomo, follows, { budget: first.budget, cacheFile: file });

  const second = client(TRADES);
  await resolveFollows(second.fomo, follows, { budget: second.budget, cacheFile: file, activityTtlMs: 0 });
  assert.equal(second.urls.length, 1);
  assert.ok(second.urls[0]?.includes("/trades"));
  assert.equal(second.budget.snapshot().wallets, 0);
});

test("verify is the only path that spends a resolution, and it caches forever", async () => {
  const file = cacheFile();
  const responses = {
    "/trades": TRADES["/trades"],
    "/v2/users/unipcs": {
      handle: "unipcs",
      displayName: "Bonk Guy",
      verified: true,
      pnlUsd: 4_200_000,
      followers: 1_200_000,
      wallets: { solana: "So1...", evm: "0xabc" },
    },
  };
  const first = client(responses);
  const rows = await resolveFollows(first.fomo, [{ handle: "unipcs" }], {
    budget: first.budget,
    cacheFile: file,
    verify: true,
  });
  assert.equal(first.budget.snapshot().wallets, 1);
  assert.equal(rows[0]?.pnlUsd, 4_200_000);
  assert.equal(rows[0]?.wallets?.solana, "So1...");
  assert.ok(rows[0]?.verifiedAt);

  // The paid-for data survives into the next process. That boot still takes
  // the one free /trades call to refresh the activity counts, but it never
  // pays for the wallets twice.
  const second = client(responses);
  const again = await resolveFollows(second.fomo, [{ handle: "unipcs" }], {
    budget: second.budget,
    cacheFile: file,
  });
  assert.deepEqual(
    second.urls.map((url) => url.includes("/trades")),
    [true],
  );
  assert.equal(second.budget.snapshot().wallets, 0, "wallets are paid for once, ever");
  assert.equal(again[0]?.pnlUsd, 4_200_000);
  assert.equal(again[0]?.activeCount, 63, "cached wallets plus fresh activity");

  // And the boot after that is free outright.
  const third = client(responses);
  await resolveFollows(third.fomo, [{ handle: "unipcs" }], { budget: third.budget, cacheFile: file });
  assert.equal(third.urls.length, 0);
});

test("with the wallet quota gone, verify falls back to the free path", async () => {
  const spent = Array.from({ length: PLAN.walletResolutionsPerMonth }, (_, i) => `t${i}`);
  const { fomo, urls, budget } = client(TRADES);
  // Pretend the month's resolutions are already spent elsewhere.
  await Promise.all(spent.map((handle) => budget.wrap(async () => new Response("{}"))(`/v2/users/${handle}`)));
  assert.equal(budget.walletsRemaining, 0);

  const rows = await resolveFollows(fomo, [{ handle: "unipcs" }], {
    budget,
    cacheFile: cacheFile(),
    verify: true,
  });
  assert.ok(urls.every((url) => url.includes("/trades")), "no profile call once the quota is gone");
  assert.equal(rows[0]?.ok, true, "and the trader is still copied");
  assert.equal(rows[0]?.activeCount, 63);
});

test("a trader with nothing captured is copied, but flagged", async () => {
  const { fomo, budget } = client({
    "/trades": { available: false, trades: [], note: "being populated from live captures." },
  });
  const rows = await resolveFollows(fomo, [{ handle: "brand_new" }], { budget, cacheFile: cacheFile() });
  assert.equal(rows[0]?.ok, true, "an uncaptured trader still fires alerts we want to copy");
  assert.equal(rows[0]?.warning, "no captured trades - unverified");
});

test("a 404 is the only thing that drops a handle from the list", async () => {
  const { fomo, budget } = client({});
  const rows = await resolveFollows(fomo, [{ handle: "typo_handle" }], { budget, cacheFile: cacheFile() });
  assert.equal(rows[0]?.ok, false);
  assert.equal(rows[0]?.reason, "no such handle on FOMO");
});

test("a stale cache is preferred to dropping a trader on a transient failure", async () => {
  const file = cacheFile();
  const warm = client(TRADES);
  await resolveFollows(warm.fomo, [{ handle: "unipcs" }], { budget: warm.budget, cacheFile: file });

  const broken: FetchLike = async () =>
    new Response(JSON.stringify({ error: "auth backend unavailable" }), { status: 503 });
  const budget = new Budget({ file: ledgerFile() });
  const fomo = new FomoClient({ apiKey: "k", fetch: budget.wrap(broken), maxRetries: 0 });
  const rows = await resolveFollows(fomo, [{ handle: "unipcs" }], {
    budget,
    cacheFile: file,
    activityTtlMs: 0,
  });
  assert.equal(rows[0]?.ok, true);
  assert.equal(rows[0]?.activeCount, 63, "the API flaps; the cache does not");
});

test("the pass gives up on time rather than blocking the stream", async () => {
  const slow: FetchLike = async () => new Promise(() => {});
  const budget = new Budget({ file: ledgerFile() });
  const fomo = new FomoClient({ apiKey: "k", fetch: budget.wrap(slow), maxRetries: 0, timeoutMs: 0 });
  const started = Date.now();
  const rows = await resolveFollows(fomo, [{ handle: "a" }, { handle: "b" }], {
    budget,
    cacheFile: cacheFile(),
    deadlineMs: 300,
  });
  assert.ok(Date.now() - started < 3_000, "boot must not hang on a slow API");
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.ok), "unresolved is not the same as undeserving");
});

/* ------------------------------------------------------------------- file */

test("the file tolerates bare strings, stray @ and duplicates", () => {
  const file = join(mkdtempSync(join(tmpdir(), "fomo-file-")), "follows.json");
  writeFileSync(file, JSON.stringify(["@Kaleo", { handle: "unipcs", weight: 2 }, "kaleo"]));
  const follows = loadFollows(file);
  assert.equal(follows.length, 2);
  assert.equal(follows[0]?.handle, "Kaleo");
  assert.equal(follows[1]?.weight, 2);
  assert.equal(normalizeHandle("  @Kaleo "), "kaleo");
});
