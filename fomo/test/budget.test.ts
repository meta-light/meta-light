/* The governor is the only thing standing between a 24/7 bot and a spent
 * quota, so it is tested against a fake clock and a fake fetch. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Budget, BudgetError, walletResolutionHandle, formatBudget } from "../src/budget.ts";
import { PLAN, RESERVE } from "../src/config.ts";
import type { FetchLike } from "../src/fomo.ts";

const ledgerFile = (): string => join(mkdtempSync(join(tmpdir(), "fomo-budget-")), "usage.json");

/** A fetch that records what it was called with and answers however we say. */
function stub(status = 200, body: unknown = { ok: true }): { fetch: FetchLike; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    fetch: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    },
  };
}

/** Seed a ledger on disk, so a test can start near a cap without making
 * thousands of calls (and without deadlocking the pacer on a frozen clock). */
function seed(partial: Record<string, unknown>): string {
  const file = ledgerFile();
  writeFileSync(
    file,
    JSON.stringify({
      month: "2026-09",
      requests: 0,
      resolutions: [],
      walletsExhausted: false,
      refused: {},
      ...partial,
    }),
  );
  return file;
}

function harness(options: { file?: string; now?: () => number } = {}) {
  const clock = { ms: Date.UTC(2026, 8, 2, 12, 0, 0) };
  const budget = new Budget({
    file: options.file ?? ledgerFile(),
    now: options.now ?? (() => clock.ms),
  });
  return { budget, clock };
}

test("only the profile endpoint counts as a wallet resolution", () => {
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/users/0xMetaLight"), "0xmetalight");
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/users/0xMetaLight/"), "0xmetalight");
  // Verified against the live API: these answer 200 with resolutions exhausted.
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/users/kaleo/trades?limit=1"), undefined);
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/users/kaleo/balances"), undefined);
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/alerts?limit=100"), undefined);
});

test("a percent-encoded handle resolves to the same ledger entry", () => {
  assert.equal(walletResolutionHandle("https://api.fomoapi.io/v2/users/Poor%5FGoat"), "poor_goat");
});

test("every request through the wrapper is counted", async () => {
  const { budget } = harness();
  const { fetch, urls } = stub();
  const governed = budget.wrap(fetch);
  await governed("https://api.fomoapi.io/v2/alerts?limit=1");
  await governed("https://api.fomoapi.io/v2/alerts?limit=1");
  assert.equal(urls.length, 2);
  assert.equal(budget.snapshot().requests, 2);
});

test("the ledger survives a restart", async () => {
  const file = ledgerFile();
  const first = harness({ file });
  await first.budget.wrap(stub().fetch)("https://api.fomoapi.io/v2/alerts");
  const second = harness({ file });
  assert.equal(second.budget.snapshot().requests, 1, "a restart must not reset the month");
  assert.match(readFileSync(file, "utf8"), /"requests": 1/);
});

test("an unreadable ledger starts clean instead of refusing to boot", () => {
  const { budget } = harness({ file: join(mkdtempSync(join(tmpdir(), "fomo-none-")), "nope.json") });
  assert.equal(budget.snapshot().requests, 0);
});

test("the monthly cap stops requests with the reserve intact", async () => {
  const usable = PLAN.requestsPerMonth - RESERVE.requestsPerMonth;
  const { budget } = harness({ file: seed({ requests: usable - 1 }) });
  const { fetch, urls } = stub();
  const governed = budget.wrap(fetch);

  await governed("https://api.fomoapi.io/v2/alerts");
  assert.equal(budget.monthlyRemaining, 0);

  await assert.rejects(() => governed("https://api.fomoapi.io/v2/alerts"), (error: unknown) => {
    assert.ok(error instanceof BudgetError);
    assert.equal(error.kind, "month");
    return true;
  });
  // Refused means not sent: the reserve survives for whatever needs it.
  assert.equal(urls.length, 1);
  assert.equal(budget.snapshot().requests, usable);
  assert.equal(PLAN.requestsPerMonth - budget.snapshot().requests, RESERVE.requestsPerMonth);
});

test("a refusal is recorded so the boot log can explain itself", async () => {
  const { budget } = harness({ file: seed({ requests: PLAN.requestsPerMonth }) });
  await budget.wrap(stub().fetch)("https://api.fomoapi.io/v2/alerts").catch(() => undefined);
  assert.equal(budget.snapshot().refused["month"], 1);
});

test("the month rolls over on the UTC boundary", async () => {
  const { budget, clock } = harness();
  await budget.wrap(stub().fetch)("https://api.fomoapi.io/v2/users/kaleo");
  assert.equal(budget.snapshot().requests, 1);
  assert.equal(budget.snapshot().wallets, 1);

  clock.ms = Date.UTC(2026, 9, 1, 0, 0, 1);
  const next = budget.snapshot();
  assert.equal(next.month, "2026-10");
  assert.equal(next.requests, 0);
  assert.equal(next.wallets, 0, "wallet resolutions come back with the calendar");
  assert.equal(next.walletsExhausted, false);
});

test("each unique handle costs one resolution, and repeats are free", async () => {
  const { budget } = harness();
  const governed = budget.wrap(stub().fetch);
  await governed("https://api.fomoapi.io/v2/users/kaleo");
  await governed("https://api.fomoapi.io/v2/users/KALEO");
  await governed("https://api.fomoapi.io/v2/users/unipcs");
  assert.equal(budget.snapshot().wallets, 2);
  assert.equal(budget.snapshot().requests, 3);
  assert.ok(budget.resolved("Kaleo"));
});

test("the 26th handle is refused locally, before it can 429", async () => {
  const spent = Array.from({ length: PLAN.walletResolutionsPerMonth }, (_, i) => `trader${i}`);
  const { budget } = harness({ file: seed({ requests: spent.length, resolutions: spent }) });
  const { fetch, urls } = stub();
  const governed = budget.wrap(fetch);
  assert.equal(budget.walletsRemaining, 0);

  await assert.rejects(() => governed("https://api.fomoapi.io/v2/users/onemore"), (error: unknown) => {
    assert.ok(error instanceof BudgetError);
    assert.equal(error.kind, "wallet");
    return true;
  });
  assert.equal(urls.length, 0, "the refused lookup never left the process");

  // A handle already paid for is still reachable with the quota gone.
  await governed("https://api.fomoapi.io/v2/users/trader0");
  assert.equal(urls.length, 1);
});

test("free endpoints keep working after the wallet quota is gone", async () => {
  const { budget } = harness({ file: seed({ walletsExhausted: true }) });
  const { fetch, urls } = stub();
  const governed = budget.wrap(fetch);
  assert.equal(budget.walletsRemaining, 0);
  await governed("https://api.fomoapi.io/v2/users/trader99/trades?limit=1");
  await governed("https://api.fomoapi.io/v2/users/trader99/balances");
  await governed("https://api.fomoapi.io/v2/alerts?limit=100");
  assert.equal(urls.length, 3, "the stream and captured data are unaffected by the wallet quota");
});

test("a wallet-resolution 429 is believed over our own count", async () => {
  const { budget } = harness();
  const governed = budget.wrap(
    stub(429, {
      error: "wallet resolution limit reached",
      limit: 25,
      plan: "free",
    }).fetch,
  );
  const response = await governed("https://api.fomoapi.io/v2/users/0xMetaLight");
  assert.equal(response.status, 429);
  // Usage predating this ledger: the API says none are left, so none are.
  assert.equal(budget.walletsRemaining, 0);
  assert.equal(budget.snapshot().walletsExhausted, true);
  // And the refused resolution is not billed to us.
  assert.equal(budget.snapshot().wallets, 0);
  assert.equal(budget.resolved("0xMetaLight"), false);
});

test("the body of a 429 is still readable by the caller", async () => {
  const { budget } = harness();
  const governed = budget.wrap(stub(429, { error: "wallet resolution limit reached" }).fetch);
  const response = await governed("https://api.fomoapi.io/v2/users/kaleo");
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "wallet resolution limit reached", "the wrapper must not consume the body");
});

test("an ordinary 429 does not condemn the wallet quota", async () => {
  const { budget } = harness();
  const governed = budget.wrap(stub(429, { error: "rate limit exceeded" }).fetch);
  await governed("https://api.fomoapi.io/v2/users/kaleo");
  assert.equal(budget.snapshot().walletsExhausted, false);
  assert.equal(budget.snapshot().wallets, 1);
});

test("bursts are paced under the per-minute allowance, not failed", async () => {
  const clock = { ms: Date.UTC(2026, 8, 2, 12, 0, 0) };
  const budget = new Budget({ file: ledgerFile(), now: () => clock.ms });
  const { fetch, urls } = stub();
  const governed = budget.wrap(fetch);
  const ceiling = PLAN.requestsPerMinute - RESERVE.requestsPerMinute;

  for (let i = 0; i < ceiling; i++) await governed("https://api.fomoapi.io/v2/alerts");
  assert.equal(urls.length, ceiling);

  // The next one has to wait; advancing the clock past the window frees it.
  const pending = governed("https://api.fomoapi.io/v2/alerts");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(urls.length, ceiling, "the ceiling holds while the window is full");
  clock.ms += 61_000;
  await pending;
  assert.equal(urls.length, ceiling + 1);
});

test("the report names the month and both quotas", () => {
  const { budget } = harness();
  const line = formatBudget(budget);
  assert.match(line, /2026-09/);
  assert.match(line, /requests 0\/10000/);
  assert.match(line, /wallet resolutions 0\/25/);
});

test("the ledger file is written atomically", async () => {
  const file = ledgerFile();
  const { budget } = harness({ file });
  await budget.wrap(stub().fetch)("https://api.fomoapi.io/v2/alerts");
  assert.ok(existsSync(file));
  assert.equal(existsSync(`${file}.tmp`), false, "the temp file must be renamed, not left behind");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { month: string; requests: number };
  assert.equal(parsed.requests, 1);
});
