import assert from "node:assert/strict";
import { test } from "node:test";

import { SignalEngine } from "../src/signals.ts";
import type { CopySignal, EngineConfig, Skip } from "../src/signals.ts";
import type { Alert } from "../src/fomo.ts";
import type { Follow } from "../src/follows.ts";

const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);

const FOLLOWS: Follow[] = [
  { handle: "CryptoKaleo", weight: 2 },
  { handle: "unipcs" },
  { handle: "quiet", mute: true },
  { handle: "solonly", chains: ["solana"] },
  { handle: "small", maxUsd: 30 },
];

function alert(over: Partial<Alert> = {}): Alert {
  return {
    id: `alrt_${Math.random().toString(36).slice(2)}`,
    ts: NOW,
    type: "buy",
    trader: "CryptoKaleo",
    token: "PONS",
    tokenAddress: "0x39dbed3a2bd333467115de45665cc57f813c4571",
    chain: "robinhood",
    chainId: 4663,
    source: "feed",
    ...over,
  };
}

/** An engine plus the signals and skips it emitted, so a test can assert on
 * both the decision and the reason. */
function harness(config: Partial<EngineConfig> = {}) {
  const signals: CopySignal[] = [];
  const skips: Skip[] = [];
  const engine = new SignalEngine(FOLLOWS, { minUsd: 10, ...config });
  engine.on("signal", (signal) => signals.push(signal));
  engine.on("skip", (skip) => skips.push(skip));
  return { engine, signals, skips, reason: () => skips.at(-1)?.reason };
}

test("a followed buy becomes a weighted signal", () => {
  const { engine, signals } = harness();
  const signal = engine.handle(alert(), NOW);

  assert.equal(signal?.side, "buy");
  assert.equal(signal?.usd, 100); // base 50 x weight 2
  assert.equal(signal?.trader, "CryptoKaleo");
  assert.equal(signal?.chainId, 4663);
  assert.equal(signal?.tokenAddress, "0x39dbed3a2bd333467115de45665cc57f813c4571");
  assert.match(signal?.sizing ?? "", /base \$50 x 2/);
  assert.equal(signals.length, 1);
  assert.equal(engine.openPositions.length, 1);
  assert.equal(engine.budget.spent, 100);
});

test("an unfollowed trader is ignored", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ trader: "randomdegen" }), NOW), null);
  assert.equal(reason(), "not-followed");
});

test("handles match case-insensitively and ignore a leading @", () => {
  const { engine } = harness();
  assert.ok(engine.handle(alert({ trader: "@cryptokaleo" }), NOW));
});

test("a muted follow stays in the list but does not trade", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ trader: "quiet" }), NOW), null);
  assert.equal(reason(), "muted");
});

test("theses and other non-trades are context, not signals", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ type: "thesis" }), NOW), null);
  assert.equal(reason(), "not-a-trade");
});

test("reads the WebSocket frame shape, where the kind lives in alertType", () => {
  const { engine } = harness();
  const signal = engine.handle(alert({ type: "alert", alertType: "buy" }), NOW);
  assert.equal(signal?.side, "buy");
});

test("the connect backlog is history, not opportunity", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ replay: true }), NOW), null);
  assert.equal(reason(), "replay");
});

test("push duplicates of the feed are dropped unless asked for", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ source: "push" }), NOW), null);
  assert.equal(reason(), "not-a-trade");

  const opted = harness({ includePush: true });
  assert.ok(opted.engine.handle(alert({ source: "push" }), NOW));
});

test("an alert without a contract address is unexecutable", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ tokenAddress: null }), NOW), null);
  assert.equal(reason(), "no-token-address");
});

test("chains outside the executor's set are dropped, globally and per follow", () => {
  const { engine, reason } = harness({ chains: ["solana"] });
  assert.equal(engine.handle(alert(), NOW), null);
  assert.equal(reason(), "chain-not-allowed");

  const perFollow = harness();
  assert.equal(perFollow.engine.handle(alert({ trader: "solonly" }), NOW), null);
  assert.equal(perFollow.reason(), "chain-not-allowed");
  assert.ok(
    perFollow.engine.handle(
      alert({ trader: "solonly", chain: "solana", chainId: 1399811149 }),
      NOW,
    ),
  );
});

test("chain aliases resolve, so a raw id alone is enough", () => {
  const { engine } = harness({ chains: ["rh"] });
  assert.ok(engine.handle(alert({ chain: null, chainId: 4663 }), NOW));
});

test("a stale alert is refused - the delayed feed is not copy trading", () => {
  const { engine, skips, reason } = harness({ maxAgeMs: 45_000 });
  assert.equal(engine.handle(alert({ ts: NOW - 60_000 }), NOW), null);
  assert.equal(reason(), "stale");
  assert.match(skips.at(-1)?.detail ?? "", /aged 60s > 45s/);
});

test("the same trade arriving twice trades once", () => {
  const { engine, reason } = harness();
  assert.ok(engine.handle(alert({ id: "a", eventId: "evt-1" }), NOW));
  assert.equal(engine.handle(alert({ id: "b", eventId: "evt-1" }), NOW), null);
  assert.equal(reason(), "duplicate");
});

test("without an eventId, trader+side+token+ts still dedupes", () => {
  const { engine, reason } = harness();
  assert.ok(engine.handle(alert({ id: "a" }), NOW));
  assert.equal(engine.handle(alert({ id: "b" }), NOW), null);
  assert.equal(reason(), "duplicate");
});

test("a trader scaling into one token is not chased", () => {
  const { engine, reason } = harness({ cooldownMs: 300_000 });
  assert.ok(engine.handle(alert({ id: "a", ts: NOW }), NOW));
  assert.equal(engine.handle(alert({ id: "b", ts: NOW + 1000 }), NOW + 1000), null);
  assert.equal(reason(), "cooldown");

  // ...but it trades again once the cooldown lapses.
  const later = NOW + 400_000;
  assert.ok(engine.handle(alert({ id: "c", ts: later }), later));
});

test("a sell with no matching entry is not a short", () => {
  const { engine, reason } = harness();
  assert.equal(engine.handle(alert({ type: "sell" }), NOW), null);
  assert.equal(reason(), "no-position");
});

test("a sell exits the position the bot opened, at its full size", () => {
  const { engine } = harness();
  engine.handle(alert({ id: "buy" }), NOW);
  assert.equal(engine.openPositions.length, 1);

  const exit = engine.handle(alert({ id: "sell", type: "sell", ts: NOW + 1000 }), NOW + 1000);
  assert.equal(exit?.side, "sell");
  assert.equal(exit?.usd, 100);
  assert.match(exit?.sizing ?? "", /exit full position/);
  assert.equal(engine.openPositions.length, 0);
});

test("any followed trader's sell can close the position", () => {
  // Copying a book, not a person: whoever we bought with, an exit is an exit.
  const { engine } = harness();
  engine.handle(alert({ id: "buy", trader: "CryptoKaleo" }), NOW);
  const exit = engine.handle(alert({ id: "sell", type: "sell", trader: "unipcs", ts: NOW + 1 }), NOW + 1);
  assert.equal(exit?.usd, 100);
});

test("the per-signal ceiling caps a heavy weight", () => {
  const { engine } = harness({ baseUsd: 200, maxUsd: 250 });
  const signal = engine.handle(alert(), NOW); // 200 x 2 = 400
  assert.equal(signal?.usd, 250);
  assert.match(signal?.sizing ?? "", /capped to \$250 \(max\)/);
});

test("a follow's own maxUsd overrides the global one", () => {
  const { engine } = harness();
  const signal = engine.handle(alert({ trader: "small" }), NOW);
  assert.equal(signal?.usd, 30);
});

test("the daily cap truncates, then blocks", () => {
  const { engine, reason } = harness({ baseUsd: 60, maxUsd: 500, dailyUsdCap: 100, cooldownMs: 0 });

  const first = engine.handle(alert({ id: "a" }), NOW); // 60 x 2 = 120 -> 100 left
  assert.equal(first?.usd, 100);
  assert.match(first?.sizing ?? "", /daily budget/);
  assert.equal(engine.budget.remaining, 0);

  assert.equal(engine.handle(alert({ id: "b", token: "CASHCAT", tokenAddress: "0xabc", ts: NOW + 1 }), NOW + 1), null);
  assert.equal(reason(), "daily-cap");
});

test("the budget resets on the UTC day boundary", () => {
  const { engine } = harness({ dailyUsdCap: 100 });
  engine.handle(alert(), NOW);
  assert.equal(engine.budget.spent, 100);

  // A fresh UTC day: the cap is whole again, so the same size goes through.
  const tomorrow = NOW + 24 * 3_600_000;
  assert.ok(engine.handle(alert({ id: "next", token: "AI", tokenAddress: "0xdef", ts: tomorrow }), tomorrow));
  assert.equal(engine.budgetAt(tomorrow).spent, 100);
});

test("a size below the floor is not worth the fees", () => {
  const { engine, reason } = harness({ baseUsd: 2, minUsd: 10 });
  assert.equal(engine.handle(alert(), NOW), null);
  assert.equal(reason(), "size-too-small");
});

test("the trader's own size rides along when the alert reports it", () => {
  const { engine } = harness();
  const signal = engine.handle(alert({ usdValue: 12_500 }), NOW);
  assert.equal(signal?.traderUsd, 12_500);
});

test("setFollows swaps the list without restarting", () => {
  const { engine, reason } = harness();
  engine.setFollows([{ handle: "unipcs" }]);
  assert.equal(engine.handle(alert({ trader: "CryptoKaleo" }), NOW), null);
  assert.equal(reason(), "not-followed");
  assert.ok(engine.handle(alert({ trader: "unipcs" }), NOW));
});

test("every alert produces a signal or exactly one skip", () => {
  const { engine, signals, skips } = harness();
  const feed = [
    alert({ id: "1" }),
    alert({ id: "2", type: "thesis" }),
    alert({ id: "3", trader: "nobody" }),
    alert({ id: "4", type: "sell", ts: NOW + 1 }),
  ];
  for (const item of feed) engine.handle(item, item.ts);
  assert.equal(signals.length + skips.length, feed.length);
});

test("a throwing listener does not break the engine", () => {
  const engine = new SignalEngine(FOLLOWS);
  engine.on("signal", () => {
    throw new Error("boom");
  });
  const seen: CopySignal[] = [];
  engine.on("signal", (signal) => seen.push(signal));
  assert.ok(engine.handle(alert(), NOW));
  assert.equal(seen.length, 1);
});
