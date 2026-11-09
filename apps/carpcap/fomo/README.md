# fomoapi

A TypeScript client for the [FOMO API](https://fomoapi.io) — verified onchain PnL, real
main wallets, trade history, holdings, theses, token boards, and the realtime alert
stream — in **one file, one class, no build step**.

- `src/fomo.ts` is the whole client: types, errors, chain helpers, `FomoClient`.
- No runtime dependencies. `fetch` and `WebSocket` are injectable.
- No `dist/`, no compile — everything runs the TypeScript source through [`tsx`](https://tsx.is).

```bash
npm install                      # tsx + typescript, dev-only
echo 'FOMO_API_KEY=sk_...' > .env
npm run leaderboard              # npx tsx examples/leaderboard.ts
```

## Quick start

```ts
import { FomoClient } from "./src/fomo.ts";

const fomo = new FomoClient({ apiKey: process.env.FOMO_API_KEY });

const { traders } = await fomo.leaderboard("24h", { limit: 10 });
const kaleo = await fomo.trader("@CryptoKaleo");
const { holdings } = await fomo.balances("CryptoKaleo");

for await (const alert of fomo.stream({ trader: "CryptoKaleo" })) {
  console.log(alert.token, alert.text);
}
```

Keyless works too — `new FomoClient()` — for the public leaderboard, token boards and
search, at 10 requests/minute. A key unlocks traders, trades, balances, theses and the
alert stream. Get one at [fomoapi.io/dashboard](https://fomoapi.io/dashboard).

## Client options

```ts
new FomoClient({
  apiKey: process.env.FOMO_API_KEY,   // omit for keyless access
  baseUrl: "https://api.fomoapi.io",
  timeoutMs: 30_000,                  // per attempt
  maxRetries: 2,                      // 408/425/429/5xx, exponential backoff + jitter
  retryBaseMs: 500,
  headers: { "x-app": "my-bot" },
  fetch: myFetch,                     // any fetch-shaped function
  onRateLimit: (rl) => console.log(rl.remaining, "left"),

  // realtime
  webSocket: WebSocket,               // required on Node < 22 (e.g. from `ws`)
  reconnect: true,                    // exponential backoff, capped
  skipReplay: false,                  // drop the backlog sent on connect
  maxQueue: 1000,                     // bounded; oldest alerts drop first
});
```

## REST surface

Every method is `async`, validates its arguments, and returns typed JSON.

| Method | Endpoint |
| --- | --- |
| `fomo.info()` | `GET /v1` |
| `fomo.health()` | `GET /health` |
| `fomo.leaderboard(window, { limit })` | `GET /v2/leaderboard/{24h\|7d\|30d\|all}` |
| `fomo.tokenBoard(board, { limit })` | `GET /v2/leaderboard/tokens/{trending\|most-held\|graduated}` |
| `fomo.trending()` · `mostHeld()` · `graduated()` | the three boards, by name |
| `fomo.trader(handle)` | `GET /v2/users/{handle}` |
| `fomo.trades(handle, { limit })` | `GET /v2/users/{handle}/trades` |
| `fomo.balances(handle)` | `GET /v2/users/{handle}/balances` |
| `fomo.trade(tradeId)` | `GET /v2/trades/{tradeId}` |
| `fomo.holders(address, { limit })` | `GET /token/{address}/holders` |
| `fomo.search(query, { type, limit })` | `GET /v2/search` |
| `fomo.searchTokens(query, { limit })` | `GET /v2/tokens/search` |
| `fomo.theses({ chain, limit })` | `GET /v2/thesis` |
| `fomo.tokenTheses(mint, { limit })` | `GET /v2/thesis/token/{mint}` |
| `fomo.userTheses(id, { limit })` | `GET /v2/thesis/user/{id}` |
| `fomo.userTokenTheses(id, address)` | `GET /v2/thesis/user/{id}/token/{address}` |
| `fomo.alerts({ trader, token, chain, type, source, since, limit })` | `GET /v2/alerts` |
| `fomo.notifications({ ... })` | `GET /v2/notifications` |
| `fomo.request<T>(path, query, opts)` | anything undocumented, with auth applied |
| `fomo.url(path, query)` | build a URL without sending it |

### Capture envelopes

Trades, balances, holders, theses, alerts and notifications answer `{ available: false }`
for traders and tokens FOMO hasn't captured yet. The client normalizes that: `available`
is always a boolean and the list is always an array, so you branch once and never guard
against `undefined`.

```ts
const { available, trades } = await fomo.trades(handle, { limit: 5 });
if (!available) console.log("not captured yet");
```

### Chains

Pass a friendly name, an alias, or a raw id — `chain: "rh"`, `"hood"`, `"robinhood"` and
`4663` are the same filter. `chainId()`, `chainName()` and `normalizeChain()` are exported
for your own code.

## Realtime

The stream lives on the client itself — one client owns at most one socket. For two
independent filter sets, construct two clients (or subscribe to the firehose and filter
locally).

```ts
import { FomoClient, alertKind } from "./src/fomo.ts";

const fomo = new FomoClient({ apiKey, skipReplay: true });

const alerts = fomo.stream({ trader: "CryptoKaleo", chain: "solana" });
const { realtime, delaySeconds } = await fomo.welcome();

for await (const alert of alerts) {
  console.log(alertKind(alert), alert.token, alert.text);
}
```

| Member | What it does |
| --- | --- |
| `stream(filters?)` | async iterable of alerts; connects on first use |
| `connect(filters?)` · `disconnect()` | explicit lifecycle |
| `welcome()` | resolves with the server's welcome frame (`realtime`, `delaySeconds`) |
| `subscribe(filters)` · `unsubscribe()` | change filters on a live socket |
| `on/off/once(event, fn)` | `alert`, `welcome`, `subscribed`, `message`, `open`, `close`, `reconnecting`, `error` |
| `connected` · `filters` · `streamUrl` · `droppedAlerts` | current state |

Filters are `trader`, `token`, `chain`, `type` and `source`. Reconnects reapply them.
A listener that throws is isolated — the others still receive the alert.

## Errors

```ts
import { FomoRateLimitError, FomoNotFoundError } from "./src/fomo.ts";

try {
  await fomo.trader("nobody");
} catch (error) {
  if (error instanceof FomoNotFoundError) return null;
  if (error instanceof FomoRateLimitError) await wait(error.retryAfterSeconds ?? 60);
  throw error;
}
```

`FomoError` is the base. `FomoHttpError` (with `status`, `url`, `body`, `rateLimit`)
splits into `FomoBadRequestError` (400), `FomoAuthError` (401), `FomoNotFoundError` (404),
`FomoRateLimitError` (429, plus `retryAfterSeconds` and `plan`) and `FomoServerError`
(5xx). Transport failures raise `FomoNetworkError` or `FomoTimeoutError`.

Rate-limit headers land on `fomo.rateLimit` after every response:

```ts
await fomo.trending();
console.log(fomo.rateLimit); // { limit: 10000, remaining: 9998, window: "month" }
```

## Examples

```bash
npm run leaderboard          # boards, tokens, theses - works keyless
npm run copy-trade           # leaderboard -> trades -> balances -> live stream
npm run smart-money -- PONS  # token -> tracked holders -> their theses
```

Each script is `npx tsx examples/<name>.ts` under the hood and reads `FOMO_API_KEY` from
`.env` via `--env-file-if-exists`.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # tsx --test test/*.test.ts (115 tests, fully offline)
```

Tests stub `fetch` and `WebSocket`, so they're deterministic and never touch the network.
There is nothing to build: `package.json` points `exports` straight at `src/fomo.ts`.

## Copy-trade bot

The repo also carries a copy-trading bot built on the client. It runs as a **dry run** —
it prints the trades it would place and executes nothing.

```bash
npm run watch                         # monitor only: what your accounts are doing
npm run watch -- --recent 5           # each account's last 5 trades, then live
npm run watch -- --history 100        # the feed's last 100 alerts, then live
npm run watch -- --all                # the whole firehose, not just your accounts
npm run watch -- --min 5000           # only trades over $5k
npm run watch -- --kind buy,sell      # only these alert kinds
npm run follows -- list               # the roster + free enrichment (PnL, hold time)
npm run follows -- verify             # spends wallet resolutions; see below
npm run usage                         # what this month has cost so far
npm run backfill                      # replay the last 100 alerts through the copy rules
npm run bot                           # copy-trade dry run: live stream, sized signals
npm run bot -- --verbose              # show every dropped alert and why
```

`--recent` is the one to reach for on a quiet roster: `/alerts` is a single global
firehose whose last 100 rows can be four minutes of a busy market and contain nothing
from your accounts, whereas `/trades` is per handle and reaches back through their whole
captured history. It costs one free request per account.

`watch` and `bot` read the same roster and the same free feed. The difference is the
risk layer: `watch` prints everything and decides nothing, `bot` runs each alert
through [src/signals.ts](src/signals.ts) and prints the position it would take.

| File | Role |
| --- | --- |
| [src/config.ts](src/config.ts) | your handle, the `FOLLOWING` roster, and the plan's limits |
| `follows.json` | optional per-trader copy settings: weight, caps, chain allowlist, mute |
| [src/watch.ts](src/watch.ts) | monitor only — the roster's alerts, unfiltered, no risk rules |
| [src/budget.ts](src/budget.ts) | `Budget` — the request ledger every REST call passes through |
| [src/follows.ts](src/follows.ts) | loads and resolves that list; the `follows` CLI |
| [src/signals.ts](src/signals.ts) | `SignalEngine` — alerts in, sized `CopySignal`s out |
| [src/index.ts](src/index.ts) | the bot: follows → firehose → engine → dry-run log |
| `usage.json` | the ledger on disk: month, request count, handles resolved (gitignored) |
| `cache/traders.json` | resolutions cached forever, free enrichment cached 12h (gitignored) |

**FOMO does not expose your follow graph.** The API authenticates an API key, not your
FOMO account: there is no follow endpoint, and `/v2/users/me` is treated as the literal
handle `me`. A trader carries a `followers` count but no `following` list. So the list
is hardcoded: `FOLLOWING` in [src/config.ts](src/config.ts) is the roster, and editing
that array is how you change who is watched. `npm run follows -- import` can bulk-parse a
paste of the app's following screen into `follows.json` instead. The two layer cleanly —
config.ts owns *who*, `follows.json` owns *how* (weight, caps, mute) — so changing one
account's size can never silently drop another. Your own handle is `MY_HANDLE`, used only
to keep you out of your own copy list.

### Staying inside the rate limits

The free plan allows **10,000 requests/month, 60/minute, and 25 wallet resolutions/month**,
and FOMO sends no `x-ratelimit-*` headers — so the only way to know what you have spent is
to count it yourself. Every REST call the bot makes, retries included, is wrapped by
`governedFetch(budget)`, which paces the minute window, refuses a call that would breach a
cap *before* it is sent, persists the tally to `usage.json`, and rolls on the UTC calendar
month. A restart resumes the same ledger. 200 requests/month and 10/minute are held back as
a reserve, so the caps are never grazed.

The scarce resource is wallet resolutions — 25 a month, three orders of magnitude tighter
than anything else, and they do not come back mid-month. Only `GET /v2/users/{handle}` (the
client's `trader()`) spends one; `/trades`, `/balances`, `/alerts` and the socket do not.
So the bot never touches the profile endpoint on its own:

- **Cold boot** costs one *free* `/trades` call per follow, cached for 12h.
- **Warm restart** costs zero requests.
- **`npm run follows -- verify`** is the only command that spends a resolution, one per
  new handle, cached permanently. It reports how many are left.
- **Steady state costs nothing at all** — the socket carries every alert on one connection.

A spent budget degrades instead of crashing: the bot logs it and boots with the follow list
unenriched, because the stream is unaffected.

The engine is the risk layer, and it is pure: no RPC, no wallet, no clock it does not
accept. Every alert either becomes a signal or emits exactly one skip reason —
`replay`, `not-a-trade`, `not-followed`, `muted`, `no-token-address`,
`chain-not-allowed`, `stale`, `duplicate`, `cooldown`, `no-position`, `daily-cap`,
`size-too-small` — so `--verbose` explains every decision.

```ts
const engine = new SignalEngine(follows, {
  baseUsd: 50,        // × the follow's weight
  maxUsd: 250,        // per-signal ceiling
  dailyUsdCap: 1000,  // per UTC day
  maxAgeMs: 45_000,   // refuse stale signals
  cooldownMs: 300_000 // per trader+token, so scaling in is not chased
});
engine.on("signal", (signal) => execute(signal)); // ← the executor plugs in here
```

Three rules worth knowing before wiring an executor to it:

- **A sell only fires against a position the bot opened.** Mirroring an exit we have no
  entry for would be opening a short.
- **Stale signals are refused.** A free key gets realtime for 24 hours, then drops to the
  60s-delayed feed; every alert then arrives older than `maxAgeMs` and is skipped. That
  is correct — copying a 60-second-old entry is paying someone else's exit. The socket
  states its delay in the `welcome` frame on *every* connection, and the bot watches that
  for the life of the process: a mid-run downgrade to the delayed or keyless feed is
  reported the moment it happens, because otherwise it looks exactly like a quiet market.
- **Push alerts are dropped by default.** They duplicate the feed, and dedupe is keyed on
  `eventId` first so the same trade cannot fire twice.

## License

MIT
