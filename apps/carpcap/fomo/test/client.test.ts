import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FomoAuthError,
  FomoBadRequestError,
  FomoClient,
  FomoError,
  FomoNotFoundError,
  FomoRateLimitError,
  FomoServerError,
  FomoTimeoutError,
} from "../src/fomo.ts";
import type { FetchLike } from "../src/fomo.ts";

interface Call {
  url: string;
  headers: Record<string, string>;
}

interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function stub(replies: Reply | Reply[]): { fetch: FetchLike; calls: Call[] } {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const reply = queue.length > 1 ? (queue.shift() as Reply) : (queue[0] as Reply);
    const status = reply.status ?? 200;
    return Promise.resolve(
      new Response(reply.body === undefined ? "" : JSON.stringify(reply.body), {
        status,
        headers: { "content-type": "application/json", ...reply.headers },
      }),
    );
  };
  return { fetch: fetchImpl, calls };
}

function client(replies: Reply | Reply[], options = {}) {
  const { fetch, calls } = stub(replies);
  return {
    calls,
    fomo: new FomoClient({ apiKey: "test-key", fetch, maxRetries: 0, retryBaseMs: 1, ...options }),
  };
}

test("sends the API key as a bearer token and hits the documented path", async () => {
  const { fomo, calls } = client({ body: { handle: "CryptoKaleo", pnlUsd: 151383 } });

  const trader = await fomo.trader("CryptoKaleo");

  assert.equal(trader.pnlUsd, 151383);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/users/CryptoKaleo");
  assert.equal(calls[0]?.headers["authorization"], "Bearer test-key");
  assert.equal(calls[0]?.headers["accept"], "application/json");
});

test("strips a leading @ and encodes the handle", async () => {
  const { fomo, calls } = client({ body: {} });
  await fomo.trader("  @weird handle  ");
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/users/weird%20handle");
});

test("omits the authorization header when keyless", async () => {
  const { fetch, calls } = stub({ body: { window: "24h", count: 0, traders: [] } });
  const fomo = new FomoClient({ fetch });

  await fomo.leaderboard("24h", { limit: 2 });

  assert.equal(fomo.authenticated, false);
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/leaderboard/24h?limit=2");
  assert.equal(calls[0]?.headers["authorization"], undefined);
});

test("rejects an invalid window and limit before any request", async () => {
  const { fomo, calls } = client({ body: {} });

  await assert.rejects(
    // @ts-expect-error - deliberately outside the union
    () => fomo.leaderboard("12h"),
    (error: unknown) => error instanceof FomoError && /Invalid window/.test((error as Error).message),
  );
  await assert.rejects(
    () => fomo.leaderboard("24h", { limit: 500 }),
    (error: unknown) => error instanceof FomoError && /between 1 and 100/.test((error as Error).message),
  );
  await assert.rejects(
    () => fomo.trades("kaleo", { limit: 0 }),
    FomoError,
  );
  assert.equal(calls.length, 0);
});

test("normalizes an available:false capture envelope to an empty array", async () => {
  const { fomo } = client({ body: { available: false } });

  const trades = await fomo.trades("uncaptured");

  assert.equal(trades.available, false);
  assert.deepEqual(trades.trades, []);
});

test("defaults available to true when the API omits it", async () => {
  const { fomo } = client({ body: { theses: [{ text: "gm" }] } });

  const theses = await fomo.theses({ limit: 1 });

  assert.equal(theses.available, true);
  assert.equal(theses.theses[0]?.text, "gm");
});

test("balances and holders normalize their own envelopes", async () => {
  const balances = await client({ body: { available: false } }).fomo.balances("nobody");
  assert.deepEqual(balances.holdings, []);

  const holders = await client({ body: { holders: [{ handle: "kaleo", valueUsd: 10 }] } }).fomo.holders(
    "So11111111111111111111111111111111111111112",
    { limit: 5 },
  );
  assert.equal(holders.holders[0]?.handle, "kaleo");
});

test("resolves chain aliases in query parameters", async () => {
  const { fomo, calls } = client({ body: { alerts: [] } });

  await fomo.alerts({ chain: "rh", type: "buy", limit: 10 });

  const url = new URL(calls[0]?.url ?? "");
  assert.equal(url.searchParams.get("chain"), "robinhood");
  assert.equal(url.searchParams.get("type"), "buy");
  assert.equal(url.searchParams.get("limit"), "10");
});

test("passes a raw chain id through untouched", async () => {
  const { fomo, calls } = client({ body: { theses: [] } });
  await fomo.theses({ chain: 4663 });
  assert.equal(new URL(calls[0]?.url ?? "").searchParams.get("chain"), "4663");
});

test("serializes a Date `since` as ISO 8601", async () => {
  const { fomo, calls } = client({ body: { notifications: [] } });

  await fomo.notifications({ since: new Date("2026-09-01T00:00:00.000Z"), notificationType: "LARGE_BUY" });

  const url = new URL(calls[0]?.url ?? "");
  assert.equal(url.searchParams.get("since"), "2026-09-01T00:00:00.000Z");
  assert.equal(url.searchParams.get("notificationType"), "LARGE_BUY");
});

test("builds the nested thesis paths", async () => {
  const { fomo, calls } = client({ body: { theses: [] } });

  await fomo.userTheses("@ansem", { sort: "likes", limit: 200 });
  await fomo.userTokenTheses("ansem", "0xabc");
  await fomo.tokenTheses("So11111111111111111111111111111111111111112", { network: "sol" });

  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/thesis/user/ansem?limit=200&sort=likes");
  assert.equal(calls[1]?.url, "https://api.fomoapi.io/v2/thesis/user/ansem/token/0xabc");
  assert.match(calls[2]?.url ?? "", /\/v2\/thesis\/token\/So111.*\?network=sol$/);
});

test("token boards validate the board name and normalize tokens", async () => {
  const { fomo, calls } = client({ body: { board: "trending", available: false } });

  const board = await fomo.trending({ limit: 5 });
  assert.deepEqual(board.tokens, []);
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/leaderboard/tokens/trending?limit=5");

  await assert.rejects(
    // @ts-expect-error - not a board
    () => fomo.tokenBoard("hot"),
    FomoError,
  );
});

test("search results discriminate on type", async () => {
  const { fomo, calls } = client({
    body: {
      results: [
        { type: "trader", handle: "ansem", pnlUsd: 1 },
        { type: "token", symbol: "PONS", address: "0x39dbed3a" },
      ],
    },
  });

  const { results } = await fomo.search("ansem", { type: "all", limit: 5 });
  const [first, second] = results;

  assert.equal(first?.type === "trader" ? first.handle : undefined, "ansem");
  assert.equal(second?.type === "token" ? second.address : undefined, "0x39dbed3a");
  assert.equal(new URL(calls[0]?.url ?? "").searchParams.get("q"), "ansem");
});

test("searchTokens reads the API's `results` key into `tokens`", async () => {
  const { fomo, calls } = client({
    body: {
      query: "PONS",
      type: "tokens",
      count: 1,
      results: [{ type: "token", symbol: "PONS", address: "0x39dbed3a", marketCapUsd: 88760971.95 }],
    },
  });

  const { tokens, count } = await fomo.searchTokens("PONS", { limit: 1 });

  assert.equal(count, 1);
  assert.equal(tokens[0]?.symbol, "PONS");
  assert.equal(tokens[0]?.address, "0x39dbed3a");
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/v2/tokens/search?q=PONS&limit=1");
});

test("requires a non-empty query", async () => {
  const { fomo } = client({ body: {} });
  await assert.rejects(() => fomo.search("   "), FomoError);
  await assert.rejects(() => fomo.trade(""), FomoError);
});

test("maps status codes onto typed errors", async () => {
  await assert.rejects(
    () => client({ status: 401, body: { error: "invalid api key" } }).fomo.trader("kaleo"),
    (error: unknown) => {
      assert.ok(error instanceof FomoAuthError);
      assert.equal(error.status, 401);
      assert.match(error.message, /invalid api key/);
      return true;
    },
  );
  await assert.rejects(
    () => client({ status: 404, body: { error: "trader not found" } }).fomo.trader("nobody"),
    FomoNotFoundError,
  );
  await assert.rejects(
    () => client({ status: 400, body: { error: "invalid window" } }).fomo.request("/v2/leaderboard/12h"),
    FomoBadRequestError,
  );
  await assert.rejects(
    () => client({ status: 503, body: { error: "upstream" } }).fomo.health(),
    FomoServerError,
  );
});

test("a 429 carries the plan, retry-after and rate-limit snapshot", async () => {
  const { fomo } = client({
    status: 429,
    body: { error: "monthly limit exceeded", limit: 10000, plan: "free" },
    headers: {
      "retry-after": "42",
      "x-ratelimit-limit": "10000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-window": "month",
    },
  });

  await assert.rejects(
    () => fomo.trader("kaleo"),
    (error: unknown) => {
      assert.ok(error instanceof FomoRateLimitError);
      assert.equal(error.retryAfterSeconds, 42);
      assert.equal(error.plan, "free");
      assert.equal(error.rateLimit?.remaining, 0);
      assert.equal(error.rateLimit?.window, "month");
      return true;
    },
  );
  assert.equal(fomo.rateLimit?.limit, 10000);
});

test("exposes rate-limit headers from successful responses", async () => {
  const seen: Array<number | null> = [];
  const { fomo } = client(
    {
      body: { ok: true, traders: 8, uptime: 1 },
      headers: { "x-ratelimit-limit": "10000", "x-ratelimit-remaining": "9997", "x-ratelimit-window": "month" },
    },
    { onRateLimit: (rl: { remaining: number | null }) => seen.push(rl.remaining) },
  );

  await fomo.health();

  assert.deepEqual(seen, [9997]);
  assert.equal(fomo.rateLimit?.remaining, 9997);
});

test("retries a 500 then succeeds", async () => {
  const { fomo, calls } = client([{ status: 500, body: { error: "boom" } }, { body: { ok: true } }], {
    maxRetries: 2,
  });

  const health = await fomo.health();

  assert.equal(health.ok, true);
  assert.equal(calls.length, 2);
});

test("retries a 429 and honours a short retry-after", async () => {
  const { fomo, calls } = client(
    [
      { status: 429, body: { error: "slow down" }, headers: { "retry-after": "0" } },
      { body: { available: true, alerts: [{ id: "a", ts: 1 }] } },
    ],
    { maxRetries: 1 },
  );

  const alerts = await fomo.alerts();

  assert.equal(alerts.alerts.length, 1);
  assert.equal(calls.length, 2);
});

test("does not retry a 404", async () => {
  const { fomo, calls } = client({ status: 404, body: { error: "trader not found" } }, { maxRetries: 3 });
  await assert.rejects(() => fomo.trader("nobody"), FomoNotFoundError);
  assert.equal(calls.length, 1);
});

test("times out a hanging request", async () => {
  const fomo = new FomoClient({
    apiKey: "k",
    maxRetries: 0,
    timeoutMs: 20,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  });

  await assert.rejects(() => fomo.health(), FomoTimeoutError);
});

test("respects a caller-supplied abort signal", async () => {
  const controller = new AbortController();
  const fomo = new FomoClient({
    apiKey: "k",
    maxRetries: 2,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
  });

  const pending = fomo.health({ signal: controller.signal });
  controller.abort();

  await assert.rejects(() => pending, FomoTimeoutError);
});

test("a captured trades response passes through with available: true", async () => {
  const { fomo } = client({ body: { available: true, trades: [{ tradeId: "t1", side: "buy" }] } });
  const { available, trades } = await fomo.trades("kaleo", { limit: 1 });
  assert.equal(available, true);
  assert.equal(trades[0]?.tradeId, "t1");
});

test("honours a custom base URL and extra headers", async () => {
  const { fetch, calls } = stub({ body: { ok: true } });
  const fomo = new FomoClient({
    apiKey: "k",
    baseUrl: "https://staging.fomoapi.io/",
    headers: { "x-trace": "abc" },
    fetch,
  });

  await fomo.health();

  assert.equal(fomo.baseUrl, "https://staging.fomoapi.io");
  assert.equal(calls[0]?.url, "https://staging.fomoapi.io/health");
  assert.equal(calls[0]?.headers["x-trace"], "abc");
});

test("request() reaches undocumented paths with auth applied", async () => {
  const { fomo, calls } = client({ body: { trades: [] } });
  await fomo.request<{ trades: unknown[] }>("/trades", { user: "kaleo" });
  assert.equal(calls[0]?.url, "https://api.fomoapi.io/trades?user=kaleo");
  assert.equal(calls[0]?.headers["authorization"], "Bearer test-key");
});
