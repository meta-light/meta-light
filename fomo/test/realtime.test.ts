import assert from "node:assert/strict";
import { test } from "node:test";

import { FomoClient } from "../src/fomo.ts";
import type { Alert, FomoClientOptions, StreamFilters, WebSocketLike } from "../src/fomo.ts";

class MockSocket implements WebSocketLike {
  static instances: MockSocket[] = [];

  readyState = 0;
  readonly url: string;
  readonly sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }

  static reset(): void {
    MockSocket.instances = [];
  }

  static get last(): MockSocket {
    const socket = MockSocket.instances[MockSocket.instances.length - 1];
    assert.ok(socket, "expected a socket to have been constructed");
    return socket;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  /* test helpers */
  accept(): this {
    this.readyState = 1;
    this.onopen?.({});
    return this;
  }

  deliver(message: unknown): this {
    this.onmessage?.({ data: JSON.stringify(message) });
    return this;
  }

  frames(): Array<Record<string, unknown>> {
    return this.sent.map((frame) => JSON.parse(frame) as Record<string, unknown>);
  }
}

/** A client wired to the mock socket, already connected. */
function connected(filters: StreamFilters = {}, options: FomoClientOptions = {}): FomoClient {
  MockSocket.reset();
  const fomo = new FomoClient({ webSocket: MockSocket, reconnectBaseMs: 1, ...options });
  return fomo.connect(filters);
}

const buy: Alert = {
  id: "alrt_1",
  ts: 1788354773139,
  type: "buy",
  text: "rvttrades bought $MOO ($55K size)",
  trader: "rvttrades",
  token: "MOO",
  tokenAddress: "0xd9db30bb0d2b8d2eae3826a1372117e058791e18",
  chainId: 4663,
  chain: "robinhood",
  source: "feed",
  usdValue: 55000,
};

async function waitFor(predicate: () => boolean, message: string, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test("builds the socket URL with key and normalized filters", () => {
  const fomo = connected({ trader: "@frankdegods", chain: "rh", type: "buy" }, { apiKey: "secret" });

  const url = new URL(MockSocket.last.url);
  assert.equal(url.protocol, "wss:");
  assert.equal(url.host, "api.fomoapi.io");
  assert.equal(url.pathname, "/ws/alerts");
  assert.equal(url.searchParams.get("key"), "secret");
  assert.equal(url.searchParams.get("trader"), "frankdegods");
  assert.equal(url.searchParams.get("chain"), "robinhood");
  assert.equal(url.searchParams.get("type"), "buy");
  fomo.disconnect();
});

test("connects keyless with no query string", () => {
  const fomo = connected();
  assert.equal(MockSocket.last.url, "wss://api.fomoapi.io/ws/alerts");
  fomo.disconnect();
});

test("derives the socket URL from baseUrl and reuses the API key", () => {
  const fomo = connected({ source: "push" }, { apiKey: "abc", baseUrl: "http://localhost:8787" });

  const url = new URL(MockSocket.last.url);
  assert.equal(url.protocol, "ws:");
  assert.equal(url.host, "localhost:8787");
  assert.equal(url.pathname, "/ws/alerts");
  assert.equal(url.searchParams.get("key"), "abc");
  assert.equal(url.searchParams.get("source"), "push");
  fomo.disconnect();
});

test("welcome() resolves with the realtime verdict", async () => {
  const fomo = connected();
  MockSocket.last.accept().deliver({ type: "welcome", realtime: false, delaySeconds: 60 });

  const welcome = await fomo.welcome();

  assert.equal(welcome.realtime, false);
  assert.equal(fomo.realtime, false);
  assert.equal(fomo.delaySeconds, 60);
  fomo.disconnect();
});

test("emits alerts to listeners and reports connection state", () => {
  const fomo = connected();
  const seen: Alert[] = [];
  fomo.on("alert", (alert) => seen.push(alert));

  MockSocket.last.accept();
  assert.equal(fomo.connected, true);
  MockSocket.last.deliver({ type: "alert", ...buy });

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.chain, "robinhood");
  assert.equal(seen[0]?.usdValue, 55000);
  fomo.disconnect();
  assert.equal(fomo.connected, false);
});

test("treats a bare kind frame carrying id+ts as an alert", () => {
  const fomo = connected();
  const seen: Alert[] = [];
  fomo.on("alert", (alert) => seen.push(alert));

  MockSocket.last.accept().deliver(buy);

  assert.equal(seen.length, 1);
  fomo.disconnect();
});

test("ignores welcome and subscribed frames as alerts", () => {
  const fomo = connected();
  let alerts = 0;
  let subscribed = 0;
  fomo.on("alert", () => alerts++);
  fomo.on("subscribed", () => subscribed++);

  MockSocket.last
    .accept()
    .deliver({ type: "welcome", realtime: true })
    .deliver({ type: "subscribed", filter: { trader: "frankdegods" } });

  assert.equal(alerts, 0);
  assert.equal(subscribed, 1);
  fomo.disconnect();
});

test("stream() iterates alerts, including ones buffered before the loop starts", async () => {
  const fomo = connected();
  MockSocket.last.accept().deliver({ type: "alert", ...buy, id: "a1" });

  const received: string[] = [];
  const loop = (async () => {
    for await (const alert of fomo.stream()) {
      received.push(alert.id);
      if (received.length === 3) break;
    }
  })();

  await waitFor(() => received.length === 1, "buffered alert was not delivered");
  MockSocket.last.deliver({ type: "alert", ...buy, id: "a2" });
  await waitFor(() => received.length === 2, "live alert was not delivered");
  MockSocket.last.deliver({ type: "alert", ...buy, id: "a3" });

  await loop;
  assert.deepEqual(received, ["a1", "a2", "a3"]);
});

test("stream() connects on first use and applies its filters", () => {
  MockSocket.reset();
  const fomo = new FomoClient({ webSocket: MockSocket });
  assert.equal(MockSocket.instances.length, 0);

  fomo.stream({ trader: "@ansem" });

  assert.equal(MockSocket.instances.length, 1);
  assert.equal(new URL(MockSocket.last.url).searchParams.get("trader"), "ansem");
  fomo.disconnect();
});

test("stream() on a live socket switches filters instead of reconnecting", () => {
  const fomo = connected({ trader: "kaleo" });
  MockSocket.last.accept();

  fomo.stream({ trader: "ansem" });

  assert.equal(MockSocket.instances.length, 1);
  assert.deepEqual(MockSocket.last.frames(), [{ action: "subscribe", trader: "ansem" }]);
  fomo.disconnect();
});

test("breaking out of the loop disconnects the socket", async () => {
  const fomo = connected();
  MockSocket.last.accept();

  const loop = (async () => {
    for await (const _alert of fomo.stream()) break;
  })();
  MockSocket.last.deliver({ type: "alert", ...buy });
  await loop;

  assert.equal(MockSocket.last.readyState, 3);
});

test("disconnect() ends an idle iteration", async () => {
  const fomo = connected();
  MockSocket.last.accept();

  const drained = (async () => {
    const ids: string[] = [];
    for await (const alert of fomo.stream()) ids.push(alert.id);
    return ids;
  })();

  setTimeout(() => fomo.disconnect(), 5);
  assert.deepEqual(await drained, []);
});

test("subscribe() switches filters without reconnecting", () => {
  const fomo = connected();
  MockSocket.last.accept();

  fomo.subscribe({ trader: "@frankdegods", chain: "hood" });

  assert.equal(MockSocket.instances.length, 1);
  assert.deepEqual(MockSocket.last.frames(), [
    { action: "subscribe", trader: "frankdegods", chain: "robinhood" },
  ]);
  assert.deepEqual(fomo.filters, { trader: "frankdegods", chain: "hood" });
  fomo.disconnect();
});

test("unsubscribe() clears filters and returns to the firehose", () => {
  const fomo = connected({ trader: "kaleo" });
  MockSocket.last.accept();

  fomo.unsubscribe();

  assert.deepEqual(MockSocket.last.frames(), [{ action: "unsubscribe" }]);
  assert.deepEqual(fomo.filters, {});
  assert.equal(fomo.streamUrl, "wss://api.fomoapi.io/ws/alerts");
  fomo.disconnect();
});

test("frames sent while disconnected are dropped, and filters survive the reconnect", async () => {
  const fomo = connected({}, { apiKey: "k" });
  MockSocket.last.accept();
  MockSocket.last.close(1006, "dropped");

  fomo.subscribe({ trader: "ansem" });
  assert.equal(MockSocket.instances[0]?.sent.length, 0);

  await waitFor(() => MockSocket.instances.length === 2, "did not reconnect");
  assert.equal(new URL(MockSocket.last.url).searchParams.get("trader"), "ansem");
  fomo.disconnect();
});

test("reconnects with backoff after an unexpected close", async () => {
  const fomo = connected();
  const attempts: number[] = [];
  fomo.on("reconnecting", (info) => attempts.push(info.attempt));

  MockSocket.last.accept();
  MockSocket.last.close(1006, "network");

  await waitFor(() => MockSocket.instances.length === 2, "did not reconnect");
  assert.deepEqual(attempts, [1]);

  MockSocket.last.accept();
  MockSocket.last.close(1006, "network again");
  await waitFor(() => MockSocket.instances.length === 3, "did not reconnect a second time");
  fomo.disconnect();
});

test("reconnect:false ends the iteration when the socket drops", async () => {
  const fomo = connected({}, { reconnect: false });
  MockSocket.last.accept();

  const closes: boolean[] = [];
  fomo.on("close", (info) => closes.push(info.willReconnect));

  const drained = (async () => {
    let count = 0;
    for await (const _alert of fomo.stream()) count++;
    return count;
  })();

  setTimeout(() => MockSocket.last.close(1006, "gone"), 5);

  assert.equal(await drained, 0);
  assert.deepEqual(closes, [false]);
  assert.equal(MockSocket.instances.length, 1);
});

test("stops after maxReconnectAttempts", async () => {
  const fomo = connected({}, { maxReconnectAttempts: 2 });
  MockSocket.last.accept();

  for (let i = 0; i < 4; i++) {
    MockSocket.last.close(1006, "flap");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.equal(MockSocket.instances.length, 3);
  fomo.disconnect();
});

test("drops the oldest alerts once the buffer is full", async () => {
  const fomo = connected({}, { maxQueue: 2 });
  MockSocket.last.accept();

  for (const id of ["a1", "a2", "a3", "a4"]) {
    MockSocket.last.deliver({ type: "alert", ...buy, id });
  }
  assert.equal(fomo.droppedAlerts, 2);

  const ids: string[] = [];
  for await (const alert of fomo.stream()) {
    ids.push(alert.id);
    if (ids.length === 2) break;
  }
  assert.deepEqual(ids, ["a3", "a4"]);
});

test("skipReplay drops the server's backlog but keeps live alerts", () => {
  const fomo = connected({}, { skipReplay: true });
  const seen: string[] = [];
  fomo.on("alert", (alert) => seen.push(alert.id));

  MockSocket.last
    .accept()
    .deliver({ type: "alert", alertType: "sell", ...buy, id: "old", replay: true })
    .deliver({ type: "alert", alertType: "buy", ...buy, id: "new" });

  assert.deepEqual(seen, ["new"]);
  fomo.disconnect();
});

test("replayed frames are delivered by default", () => {
  const fomo = connected();
  const seen: string[] = [];
  fomo.on("alert", (alert) => seen.push(alert.id));

  MockSocket.last.accept().deliver({ type: "alert", ...buy, id: "old", replay: true });

  assert.deepEqual(seen, ["old"]);
  fomo.disconnect();
});

test("a malformed frame surfaces as an error event, not a throw", () => {
  const fomo = connected();
  const errors: string[] = [];
  fomo.on("error", (error) => errors.push(error.message));

  MockSocket.last.accept();
  MockSocket.last.onmessage?.({ data: "<html>nope</html>" });

  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /non-JSON|JSON/i);
  fomo.disconnect();
});

test("a throwing listener does not break delivery to the others", () => {
  const fomo = connected();
  const errors: string[] = [];
  const seen: string[] = [];
  fomo.on("error", (error) => errors.push(error.message));
  fomo.on("alert", () => {
    throw new Error("listener blew up");
  });
  fomo.on("alert", (alert) => seen.push(alert.id));

  MockSocket.last.accept().deliver({ type: "alert", ...buy });

  assert.deepEqual(seen, ["alrt_1"]);
  assert.deepEqual(errors, ["listener blew up"]);
  fomo.disconnect();
});

test("off() and once() manage listeners", () => {
  const fomo = connected();
  const seen: string[] = [];
  const listener = (alert: Alert) => seen.push(`on:${alert.id}`);
  fomo.on("alert", listener);
  fomo.once("alert", (alert) => seen.push(`once:${alert.id}`));

  MockSocket.last.accept().deliver({ type: "alert", ...buy, id: "a1" });
  fomo.off("alert", listener);
  MockSocket.last.deliver({ type: "alert", ...buy, id: "a2" });

  assert.deepEqual(seen, ["on:a1", "once:a1"]);
  fomo.disconnect();
});

test("constructing a client opens no socket, and reconnecting after disconnect() works", () => {
  MockSocket.reset();
  const fomo = new FomoClient({ webSocket: MockSocket });
  assert.equal(MockSocket.instances.length, 0);

  fomo.connect();
  assert.equal(MockSocket.instances.length, 1);

  fomo.disconnect();
  fomo.connect();
  assert.equal(MockSocket.instances.length, 2);
  fomo.disconnect();
});
