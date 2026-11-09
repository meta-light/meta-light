import assert from "node:assert/strict";
import { test } from "node:test";

import { CHAIN_IDS, alertKind, chainId, chainName, isPush, normalizeChain } from "../src/fomo.ts";

test("normalizes names, aliases and raw ids", () => {
  assert.equal(normalizeChain("robinhood"), "robinhood");
  assert.equal(normalizeChain("HOOD"), "robinhood");
  assert.equal(normalizeChain(" rh "), "robinhood");
  assert.equal(normalizeChain("sol"), "solana");
  assert.equal(normalizeChain("bnb"), "bsc");
  assert.equal(normalizeChain("ethereum"), "eth");
  assert.equal(normalizeChain(4663), "4663");
  assert.equal(normalizeChain("some-new-chain"), "some-new-chain");
});

test("maps between chain names and ids", () => {
  assert.equal(CHAIN_IDS.robinhood, 4663);
  assert.equal(chainId("rh"), 4663);
  assert.equal(chainId("sol"), 1399811149);
  assert.equal(chainId("nope"), undefined);
  assert.equal(chainName(4663), "robinhood");
  assert.equal(chainName(1399811149), "solana");
  assert.equal(chainName(999999), undefined);
});

test("alertKind reads whichever field the payload used", () => {
  // REST rows put the kind in `type`.
  assert.equal(alertKind({ id: "a", ts: 1, type: "buy" }), "buy");
  // WebSocket frames set type:"alert" and carry the kind in `alertType`.
  assert.equal(alertKind({ id: "a", ts: 1, type: "alert", alertType: "sell" }), "sell");
  assert.equal(alertKind({ id: "a", ts: 1, alertType: "thesis" }), "thesis");
  assert.equal(alertKind({ id: "a", ts: 1, type: "alert" }), undefined);
  assert.equal(alertKind({ id: "a", ts: 1 }), undefined);
});

test("isPush separates mobile pushes from feed activity", () => {
  assert.equal(isPush({ id: "a", ts: 1, source: "push" }), true);
  assert.equal(isPush({ id: "a", ts: 1, source: "feed" }), false);
});
