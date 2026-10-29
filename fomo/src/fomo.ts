/**
 * fomoapi - a single-file TypeScript client for the FOMO API (https://fomoapi.io).
 *
 * Everything lives here: the response types, the error hierarchy, the chain
 * helpers, and one `FomoClient` class that owns both the REST surface and the
 * realtime alert socket.
 *
 * ```ts
 * import { FomoClient } from "./src/index.ts";
 *
 * const fomo = new FomoClient({ apiKey: process.env.FOMO_API_KEY });
 * const { traders } = await fomo.leaderboard("24h", { limit: 10 });
 * const kaleo = await fomo.trader("@CryptoKaleo");
 *
 * for await (const alert of fomo.stream({ trader: "CryptoKaleo" })) {
 *   console.log(alert.token, alert.text);
 * }
 * ```
 */

/* ==========================================================================
 * Types
 * ========================================================================== */


/** Leaderboard ranking window. */
export type LeaderboardWindow = "24h" | "7d" | "30d" | "all";

/** Token board exposed under `/v2/leaderboard/tokens/*`. */
export type TokenBoard = "trending" | "most-held" | "graduated";

/** Chain filter accepted by the alert, thesis and stream endpoints: a friendly
 * name, an alias (`hood`, `rh`), or a raw chain id. */
export type ChainFilter = string | number;

/** Rate-limit state parsed from `x-ratelimit-*` response headers. */
export interface RateLimit {
  /** Your ceiling: requests per minute (keyless) or per month (keyed). */
  limit: number | null;
  /** Requests left in the current window. */
  remaining: number | null;
  /** `"month"` for keyed requests, minute-based for anonymous ones. */
  window: string | null;
  /** From `retry-after`, present on a 429. */
  retryAfterSeconds?: number;
}

/* ------------------------------------------------------------------ meta */

export interface ApiInfo {
  name: string;
  description?: string;
  version: string;
  /** Present on keyed requests. */
  tier?: string;
  auth?: Record<string, string>;
  rateLimit?: string;
  dataset?: { source?: string; traders?: number; capturedAt?: string };
  /** Self-describing catalog: `"GET /v2/leaderboard/{window}"` -> description. */
  endpoints?: Record<string, string>;
  realtime?: Record<string, string>;
  note?: string;
  docs?: string;
}

export interface Health {
  ok: boolean;
  traders: number;
  /** Process uptime in seconds. */
  uptime: number;
}

/* --------------------------------------------------------------- traders */

/** A trader's real main wallets. `status: "resolving"` means the main wallet is
 * still being indexed (FOMO only exposes a throwaway signer wallet, which this
 * API never surfaces). */
export interface Wallets {
  solana?: string | null;
  evm?: string | null;
  status?: "resolving" | string;
}

/** PnL in USD per ranking window. */
export interface PnlByWindow {
  "24h"?: number;
  "7d"?: number;
  "30d"?: number;
  all?: number;
}

/** One row of `/v2/leaderboard/{window}`. */
export interface LeaderboardTrader {
  /** Position in this window, 1 = top. */
  rank: number;
  handle: string;
  displayName?: string;
  avatar?: string;
  /** Realized PnL in USD for the window. */
  pnlUsd: number;
  volumeUsd?: number;
  trades?: number;
  followers?: number;
  /** Number of tokens currently held. */
  holdings?: number;
  wallets?: Wallets;
  topTokens?: string[];
  /** PnL derived from onchain trades rather than self-reported. */
  verified?: boolean;
}

export interface LeaderboardResponse {
  window: LeaderboardWindow;
  source?: string;
  capturedAt?: string;
  count: number;
  traders: LeaderboardTrader[];
}

/** Extra profile block some responses nest instead of flattening. */
export interface TraderProfile {
  followers?: number;
  averageHoldTimeSeconds?: number;
  fomoCreatedAt?: string;
  accountAgeDays?: number;
}

/** `/v2/users/{handle}` - a resolved trader. */
export interface Trader {
  handle: string;
  displayName?: string;
  verified?: boolean;
  wallets?: Wallets;
  /** PnL per window; `pnlUsd` is all-time. */
  pnl?: PnlByWindow;
  pnlUsd?: number;
  volumeUsd?: number;
  trades?: number;
  followers?: number;
  /** FOMO signup timestamp. Also mirrored under `profile`. */
  fomoCreatedAt?: string;
  accountAgeDays?: number;
  averageHoldTimeSeconds?: number;
  holdings?: unknown[] | number;
  topTokens?: string[];
  profile?: TraderProfile;
}

export interface TokenRef {
  symbol?: string;
  address?: string;
  name?: string;
}

/** One row of `/v2/users/{handle}/trades`.
 *
 * `source: "captured"` rows carry the rich on-device history (entry/exit,
 * open/closed status); `source: "feed"` rows are live trades indexed from the
 * activity feed for any active trader, and carry only side/size. */
export interface Trade {
  /** FOMO trade id - pass to {@link FomoClient.trades.get}. Captured rows only. */
  tradeId?: string;
  token?: TokenRef;
  side?: "buy" | "sell" | string;
  sizeUsd?: number;
  status?: "open" | "closed" | string;
  /** Token size held / traded. */
  amount?: number;
  avgEntryPrice?: number;
  avgExitPrice?: number;
  realizedPnlUsd?: number;
  unrealizedPnlUsd?: number;
  chainId?: number;
  /** Friendly chain name, e.g. `"robinhood"` for chain id 4663. */
  chain?: string;
  /** Unix millis. */
  ts?: number;
  source?: "captured" | "feed" | string;
  createdAt?: string;
  closedAt?: string | null;
}

export interface TradesResponse {
  /** `false` until this trader has been captured; `trades` is then empty. */
  available: boolean;
  trades: Trade[];
  count?: number;
  handle?: string;
  source?: string;
  /** Open and closed position counts across the trader's whole history, not
   * just the page returned. A cheap activity signal: this endpoint is served
   * from captured data and costs no wallet resolution. */
  activeCount?: number;
  closedCount?: number;
  capturedAt?: string;
}

export interface Holding {
  token?: TokenRef;
  amount?: number;
  priceUsd?: number;
  valueUsd?: number;
  /** 24h price move, in percent. */
  change24h?: number;
}

export interface BalancesResponse {
  /** `false` until this trader has been captured; `holdings` is then empty. */
  available: boolean;
  holdings: Holding[];
  /** Sum of all holdings. */
  totalValueUsd?: number;
  otherPnl?: unknown;
  livePerpPnl?: unknown;
  hyperliquidPerps?: unknown;
  handle?: string;
}

export interface TradeSwap {
  [key: string]: unknown;
}

/** `/v2/trades/{tradeId}` - the onchain legs behind one trade. */
export interface TradeDetail {
  available?: boolean;
  tradeId?: string;
  /** Handle who made the trade. */
  trader?: string;
  token?: TokenRef;
  swaps?: TradeSwap[];
  transfers?: TradeSwap[];
  avgEntryPrice?: number;
  avgExitPrice?: number;
  realizedPnlUsd?: number;
  unrealizedPnlUsd?: number;
  /** Whether the trader is the token's dev. */
  isDev?: boolean;
  status?: string;
  createdAt?: string;
  closedAt?: string | null;
}

/* ---------------------------------------------------------------- tokens */

/** One row of a token board. */
export interface BoardToken {
  /** Current position on FOMO's board, 1 = top. FOMO's ordering is mirrored
   * exactly, so a filtered honeypot leaves a gap rather than resequencing. */
  rank?: number;
  image?: string;
  token?: TokenRef;
  holders?: number;
  network?: string;
  priceUsd?: number;
  change24h?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  /** Observed FOMO buyers. Tokens with zero are never surfaced. */
  fomoBuyers?: number;
}

export interface TokenBoardResponse {
  /** `false` until the board has been captured; `tokens` is then empty. */
  available: boolean;
  board?: TokenBoard | string;
  capturedAt?: string;
  count?: number;
  tokens: BoardToken[];
}

/** One row of `/token/{address}/holders` - a smart-money holder. */
export interface TokenHolder {
  handle: string;
  amount?: number;
  valueUsd?: number;
  priceUsd?: number;
}

export interface TokenHoldersResponse {
  available: boolean;
  holders: TokenHolder[];
  count?: number;
  address?: string;
}

/* ---------------------------------------------------------------- theses */

/** The reasoning a trader wrote about a coin. */
export interface Thesis {
  text: string;
  handle?: string;
  /** Display name. */
  name?: string;
  /** FOMO user id. */
  userId?: string;
  /** The author's position value, in USD. */
  equity?: number;
  /** Size of the trade, in USD. */
  tradeUsd?: number;
  /** Whether the author is the token dev. */
  isDev?: boolean;
  /** Unix millis, or an ISO string on some rows. */
  ts?: number | string;
  likes?: number;
  replies?: number;
  links?: unknown[];
  token?: TokenRef;
  networkId?: number;
  /** Friendly chain name, e.g. `"robinhood"` for network id 4663. */
  chain?: string;
}

export interface ThesesResponse {
  /** `false` until the coin or trader has been captured; `theses` is then empty. */
  available: boolean;
  theses: Thesis[];
  count?: number;
}

/* ---------------------------------------------------------------- search */

export interface TraderSearchResult extends Trader {
  type: "trader";
}

export interface TokenSearchResult {
  type: "token";
  symbol?: string;
  address?: string;
  name?: string;
  image?: string;
  marketCapUsd?: number;
  networkId?: number;
}

/** A `/v2/search` hit. Discriminate on `type`. */
export type SearchResult = TraderSearchResult | TokenSearchResult;

export interface SearchResponse {
  query?: string;
  count?: number;
  results: SearchResult[];
}

export interface TokenSearchItem {
  symbol?: string;
  address?: string;
  name?: string;
  image?: string;
  marketCapUsd?: number;
  networkId?: number;
}

export interface TokenSearchResponse {
  query?: string;
  count?: number;
  tokens: TokenSearchItem[];
}

/* -------------------------------------------------------------- activity */

export type AlertType = "buy" | "sell" | "thesis" | "whale" | "price" | "trade" | "follow" | (string & {});

/** One item of the activity firehose, and the payload of a `{type:"alert"}`
 * WebSocket message. Push notifications are the `source: "push"` subset. */
export interface Alert {
  id: string;
  /** Unix millis. */
  ts: number;
  text?: string;
  /** Alert kind on REST rows (`buy`, `sell`, `thesis`, ...). WebSocket frames
   * instead set `type: "alert"` and put the kind in `alertType`, so read
   * {@link alertKind} rather than either field directly. */
  type?: AlertType | "alert";
  alertType?: AlertType;
  /** `true` on the backlog the socket replays right after connecting or
   * subscribing. Skip these when an alert must trigger an action. */
  replay?: boolean;
  /** `"feed"` for activity, `"push"` for a captured mobile push notification. */
  source?: "feed" | "push" | (string & {});
  /** FOMO's own push notification type, e.g. `"LARGE_BUY"`. `null` on untyped pushes. */
  notificationType?: string | null;
  trader?: string | null;
  /** Token symbol. */
  token?: string | null;
  /** Token contract address. */
  tokenAddress?: string | null;
  chainId?: number | null;
  /** Friendly chain name, e.g. `"robinhood"` for chain id 4663. */
  chain?: string | null;
  usdValue?: number | null;
  eventId?: string;
  raw?: { text?: string; title?: string } & Record<string, unknown>;
}

export interface AlertsResponse {
  available: boolean;
  alerts: Alert[];
  count?: number;
  source?: string;
  /** WebSocket URL for the live version of this feed. */
  stream?: string;
}

export interface NotificationsResponse {
  available: boolean;
  notifications: Alert[];
  count?: number;
  source?: string;
}

/* ------------------------------------------------------------- websocket */

/** First message on a WebSocket connection: whether you are getting realtime. */
export interface WelcomeMessage {
  type: "welcome";
  /** Whether this connection gets undelayed alerts. */
  realtime?: boolean;
  /** Feed delay: 0 when realtime, 60 for keyless and expired free keys. */
  delaySeconds?: number;
  /** Stream name, e.g. `"alerts"`. */
  stream?: string;
  /** How many recent alerts the server holds for replay. */
  buffered?: number;
  /** The filter the server applied, e.g. `{ chainId: "4663" }`. */
  filter?: Record<string, string>;
  note?: string;
  [key: string]: unknown;
}

export interface AlertMessage extends Alert {
  type: AlertType;
}

/** Server acknowledgement of a runtime `subscribe` action. */
export interface SubscribedMessage {
  type: "subscribed";
  filter?: Record<string, string>;
  [key: string]: unknown;
}

/** Any message the alert socket can deliver. */
export type StreamMessage =
  | WelcomeMessage
  | SubscribedMessage
  | ({ type: "alert" } & Alert)
  | ({ type: string } & Record<string, unknown>);

/* ==========================================================================
 * Errors
 * ========================================================================== */


/** Base class for every error this client throws. */
export class FomoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The request never produced an HTTP response (DNS, TCP, CORS, offline). */
export class FomoNetworkError extends FomoError {}

/** The request exceeded `timeoutMs`, or the caller's `signal` aborted it. */
export class FomoTimeoutError extends FomoError {}

export interface FomoHttpErrorInit {
  status: number;
  url: string;
  body?: unknown;
  rateLimit?: RateLimit;
  cause?: unknown;
}

/** A non-2xx response. `body` is the parsed JSON error payload when there was one. */
export class FomoHttpError extends FomoError {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;
  readonly rateLimit?: RateLimit;

  constructor(message: string, init: FomoHttpErrorInit) {
    super(message, { cause: init.cause });
    this.status = init.status;
    this.url = init.url;
    this.body = init.body;
    this.rateLimit = init.rateLimit;
  }
}

/** 400 - e.g. an invalid leaderboard window. */
export class FomoBadRequestError extends FomoHttpError {}

/** 401 - missing or invalid API key. Most data endpoints require one. */
export class FomoAuthError extends FomoHttpError {}

/** 404 - unknown endpoint, handle, or trade id. */
export class FomoNotFoundError extends FomoHttpError {}

/** 429 - per-minute (keyless) or monthly (keyed) quota exhausted. */
export class FomoRateLimitError extends FomoHttpError {
  /** Seconds to wait, from the `retry-after` header, when the API sent one. */
  readonly retryAfterSeconds?: number;
  /** Plan name reported in the error body, e.g. `"free"`. */
  readonly plan?: string;

  constructor(
    message: string,
    init: FomoHttpErrorInit & { retryAfterSeconds?: number; plan?: string },
  ) {
    super(message, init);
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.plan = init.plan;
  }
}

/** 5xx - the API failed to serve the request. */
export class FomoServerError extends FomoHttpError {}

function httpErrorFor(message: string, init: FomoHttpErrorInit & { retryAfterSeconds?: number; plan?: string }): FomoHttpError {
  switch (init.status) {
    case 400:
      return new FomoBadRequestError(message, init);
    case 401:
    case 403:
      return new FomoAuthError(message, init);
    case 404:
      return new FomoNotFoundError(message, init);
    case 429:
      return new FomoRateLimitError(message, init);
    default:
      return init.status >= 500
        ? new FomoServerError(message, init)
        : new FomoHttpError(message, init);
  }
}

/* ==========================================================================
 * Chains
 * ========================================================================== */


/** Chain ids the API tags alerts, trades and theses with.
 *
 * `robinhood` (4663) currently carries the largest share of FOMO volume, and
 * accepts the aliases `hood` and `rh` wherever a chain filter is taken. */
export const CHAIN_IDS = {
  robinhood: 4663,
  solana: 1399811149,
  eth: 1,
  base: 8453,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
} as const satisfies Record<string, number>;

export type ChainName = keyof typeof CHAIN_IDS;

const ALIASES: Record<string, ChainName> = {
  hood: "robinhood",
  rh: "robinhood",
  robinhood: "robinhood",
  sol: "solana",
  solana: "solana",
  eth: "eth",
  ethereum: "eth",
  base: "base",
  bsc: "bsc",
  bnb: "bsc",
  polygon: "polygon",
  matic: "polygon",
  arbitrum: "arbitrum",
  arb: "arbitrum",
};

/** Resolve a chain name, alias or raw id to the string the API expects.
 * Unknown values pass through untouched - the API accepts raw chain ids. */
export function normalizeChain(chain: ChainFilter): string {
  if (typeof chain === "number") return String(chain);
  const key = chain.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

/** Chain id for a name or alias, or `undefined` if it isn't a known chain. */
export function chainId(chain: string): number | undefined {
  const name = ALIASES[chain.trim().toLowerCase()];
  return name ? CHAIN_IDS[name] : undefined;
}

/** Friendly name for a chain id, or `undefined` when the id isn't known. */
export function chainName(id: number): ChainName | undefined {
  for (const [name, value] of Object.entries(CHAIN_IDS)) {
    if (value === id) return name as ChainName;
  }
  return undefined;
}

/** The alert kind (`buy`, `sell`, `thesis`, ...), reading whichever field the
 * payload used: REST rows put it in `type`, WebSocket frames set
 * `type: "alert"` and carry the kind in `alertType`. */
export function alertKind(alert: Alert): AlertType | undefined {
  if (alert.alertType) return alert.alertType;
  if (alert.type && alert.type !== "alert") return alert.type;
  return undefined;
}

/** Whether an alert came from a FOMO mobile push rather than the activity feed. */
export function isPush(alert: Alert): boolean {
  return alert.source === "push";
}

/* ==========================================================================
 * Client options
 * ========================================================================== */

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

/** A fetch-compatible function. Supply your own to add proxies, caching or
 * instrumentation - the client never touches globals other than through this. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<Response>;

/** Minimal WebSocket surface, satisfied by the browser/Node global and by the
 * `ws` package - so either can be injected. */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

/** Server-side filters for the alert socket. Omit everything for the firehose. */
export interface StreamFilters {
  /** One trader's buys, sells and theses only. */
  trader?: string;
  /** Token symbol or contract address. */
  token?: string;
  /** Chain name, alias (`hood`/`rh`) or raw chain id. */
  chain?: ChainFilter;
  /** `buy`, `sell`, `thesis`, `whale`, `price`, `trade`. */
  type?: AlertType;
  /** `feed` for activity, `push` for mobile push notifications only. */
  source?: "feed" | "push";
}

export interface FomoClientOptions {
  /** API key sent as `authorization: Bearer <key>` on REST calls and as
   * `?key=` on the socket. Required by every data endpoint; discovery, the
   * trader leaderboard and `/v2/alerts` work without one. */
  apiKey?: string;
  /** Defaults to `https://api.fomoapi.io`. */
  baseUrl?: string;
  /** Per-attempt REST timeout in ms. Default 30000. `0` disables it. */
  timeoutMs?: number;
  /** Retries for 429/5xx/network failures. Default 2 (3 attempts total). */
  maxRetries?: number;
  /** Base backoff in ms, doubled per attempt and jittered. Default 500. */
  retryBaseMs?: number;
  /** Ceiling for a single backoff wait, in ms. Default 20000. */
  retryMaxDelayMs?: number;
  /** Extra headers on every REST request. */
  headers?: Record<string, string>;
  /** Override the fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Called after every response that carried `x-ratelimit-*` headers. */
  onRateLimit?: (rateLimit: RateLimit) => void;

  /* ---- realtime (see `stream`, `connect`) ---- */

  /** Socket URL. Defaults to `<baseUrl>` with `http` swapped for `ws`, plus
   * `/ws/alerts`. */
  streamUrl?: string;
  /** Reconnect automatically after a drop. Default `true`. */
  reconnect?: boolean;
  /** Base reconnect backoff in ms, doubled per attempt and jittered. Default 1000. */
  reconnectBaseMs?: number;
  /** Ceiling for a reconnect wait, in ms. Default 30000. */
  reconnectMaxDelayMs?: number;
  /** Give up after this many consecutive failures. Default `Infinity`. */
  maxReconnectAttempts?: number;
  /** Force a reconnect when no frame arrives for this long. Default 0 (off). */
  staleTimeoutMs?: number;
  /** Drop the backlog the server replays on connect and after `subscribe`
   * (frames flagged `replay: true`), so only genuinely new alerts arrive.
   * Default `false`. */
  skipReplay?: boolean;
  /** How many alerts to buffer for `for await` consumers before dropping the
   * oldest. Default 1000. */
  maxQueue?: number;
  /** Override the WebSocket implementation (e.g. `ws` on Node <22). */
  webSocket?: WebSocketConstructor;
}

/** Per-call overrides. */
export interface RequestOptions {
  /** Abort the request (and any pending retry). */
  signal?: AbortSignal;
  /** Override the per-attempt timeout for this call. */
  timeoutMs?: number;
  /** Override the retry count for this call. */
  maxRetries?: number;
  headers?: Record<string, string>;
}

/** Common `?limit=` option. The API caps it at 100 and defaults to 50. */
export interface LimitOptions extends RequestOptions {
  /** 1-100. */
  limit?: number;
}

export interface ThesisFeedOptions extends LimitOptions {
  /** Restrict to one chain: name, alias (`hood`/`rh`) or raw chain id. */
  chain?: ChainFilter;
}

export interface TokenThesesOptions extends LimitOptions {
  network?: "sol" | "bnb" | "base" | "eth";
}

export interface UserThesesOptions extends ThesisFeedOptions {
  /** `likes` = most-liked first, `recent` = newest first. */
  sort?: "likes" | "recent";
}

export interface SearchOptions extends LimitOptions {
  /** Restrict the result set. Defaults to `all` server-side. */
  type?: "traders" | "tokens" | "all";
}

export interface AlertsOptions extends LimitOptions {
  /** `buy`, `sell`, `thesis`, `whale`, `price`, `trade`, `follow`. */
  type?: AlertType;
  chain?: ChainFilter;
  /** ISO string, unix seconds/millis, or a `Date`. */
  since?: string | number | Date;
}

export interface NotificationsOptions extends LimitOptions {
  /** One of FOMO's own types, e.g. `LARGE_BUY`. Setting this drops untyped pushes. */
  notificationType?: string;
  since?: string | number | Date;
}

/** Events emitted by the realtime socket. */
export interface StreamEvents {
  open: () => void;
  welcome: (message: WelcomeMessage) => void;
  alert: (alert: Alert) => void;
  subscribed: (message: SubscribedMessage) => void;
  /** Every decoded frame, including welcome and alerts. */
  message: (message: StreamMessage) => void;
  error: (error: Error) => void;
  close: (info: { code?: number; reason?: string; willReconnect: boolean }) => void;
  reconnecting: (info: { attempt: number; delayMs: number }) => void;
}

const DEFAULT_BASE_URL = "https://api.fomoapi.io";
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const WINDOWS: readonly LeaderboardWindow[] = ["24h", "7d", "30d", "all"];
const BOARDS: readonly TokenBoard[] = ["trending", "most-held", "graduated"];

/* ==========================================================================
 * FomoClient
 * ========================================================================== */

/**
 * The whole FOMO API in one class: REST endpoints, retries, rate-limit
 * accounting, and the realtime alert socket.
 *
 * ```ts
 * const fomo = new FomoClient({ apiKey: process.env.FOMO_API_KEY });
 *
 * const { traders } = await fomo.leaderboard("24h", { limit: 10 });
 * const trader = await fomo.trader("@CryptoKaleo");
 * const { trades } = await fomo.trades("CryptoKaleo", { limit: 20 });
 *
 * for await (const alert of fomo.stream({ trader: "CryptoKaleo" })) {
 *   console.log(alert.token, alert.text);
 * }
 * ```
 *
 * `info`, `health`, `leaderboard` and `alerts` work without a key; every other
 * endpoint throws {@link FomoAuthError} without one.
 *
 * One client owns at most one socket. Need two filter sets at once? Either
 * construct a second client, or filter one firehose yourself.
 */
export class FomoClient {
  /** Normalized base URL, no trailing slash. */
  readonly baseUrl: string;
  /** Rate-limit state from the most recent response that reported it. */
  rateLimit: RateLimit | undefined;
  /** Whether the socket's welcome message reported a realtime (undelayed) feed. */
  realtime: boolean | undefined;
  /** Feed delay in seconds, from the socket's welcome message. */
  delaySeconds: number | undefined;
  /** Alerts dropped because the `for await` buffer was full. */
  droppedAlerts = 0;

  private readonly options: FomoClientOptions;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly baseHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;
  private readonly onRateLimit: ((rateLimit: RateLimit) => void) | undefined;

  private readonly listeners = new Map<keyof StreamEvents, Set<(...args: never[]) => void>>();
  private readonly queue: Alert[] = [];
  private readonly waiters: Array<(result: IteratorResult<Alert>) => void> = [];
  private streamFilters: StreamFilters = {};
  private socket: WebSocketLike | undefined;
  private welcomePromise: Promise<WelcomeMessage> | undefined;
  private resolveWelcome: ((message: WelcomeMessage) => void) | undefined;
  private rejectWelcome: ((error: Error) => void) | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private staleTimer: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private disconnected = false;

  constructor(options: FomoClientOptions = {}) {
    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new FomoNetworkError(
        "No fetch implementation found. Pass `fetch` in the client options (Node 18+ has it built in).",
      );
    }
    this.options = options;
    this.fetchImpl = fetchImpl;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 20_000;
    this.baseHeaders = { accept: "application/json", ...options.headers };
    this.onRateLimit = options.onRateLimit;
  }

  /** Whether an API key was configured. Data endpoints 401 without one. */
  get authenticated(): boolean {
    return Boolean(this.apiKey);
  }

  /* ------------------------------------------------------------------ meta */

  /** `GET /v1` - version, tier, rate limit, dataset size and endpoint catalog. */
  async info(options?: RequestOptions): Promise<ApiInfo> {
    return this.request<ApiInfo>("/v1", undefined, options);
  }

  /** `GET /health` - liveness, loaded trader count, process uptime. */
  async health(options?: RequestOptions): Promise<Health> {
    return this.request<Health>("/health", undefined, options);
  }

  /* --------------------------------------------------------------- traders */

  /** `GET /v2/users/{handle}` - resolve a handle to both wallets, verified PnL
   * and stats. Case-insensitive, a leading `@` is fine. Throws
   * {@link FomoNotFoundError} when the handle isn't in the dataset. */
  async trader(handle: string, options?: RequestOptions): Promise<Trader> {
    return this.request<Trader>(`/v2/users/${encodeHandle(handle)}`, undefined, options);
  }

  /** `GET /v2/users/{handle}/trades` - trade history for copy-trading.
   * `available: false` (with an empty array) until the trader is captured. */
  async trades(handle: string, options: LimitOptions = {}): Promise<TradesResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/users/${encodeHandle(handle)}/trades`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TradesResponse>(raw, "trades");
  }

  /** `GET /v2/users/{handle}/balances` - the live portfolio, for mirroring
   * positions. `available: false` until the trader is captured. */
  async balances(handle: string, options: RequestOptions = {}): Promise<BalancesResponse> {
    const raw = await this.request<unknown>(
      `/v2/users/${encodeHandle(handle)}/balances`,
      undefined,
      options,
    );
    return normalizeList<BalancesResponse>(raw, "holdings");
  }

  /** `GET /v2/trades/{tradeId}` - swaps, transfers, average entry/exit,
   * realized PnL and whether the trader is the token dev. */
  async trade(tradeId: string, options?: RequestOptions): Promise<TradeDetail> {
    return this.request<TradeDetail>(
      `/v2/trades/${encodeURIComponent(requireArg(tradeId, "tradeId"))}`,
      undefined,
      options,
    );
  }

  /* ---------------------------------------------------------- leaderboards */

  /** `GET /v2/leaderboard/{window}` - traders ranked by verified PnL over
   * `24h`, `7d`, `30d` or `all`. Works without an API key. */
  async leaderboard(
    window: LeaderboardWindow,
    options: LimitOptions = {},
  ): Promise<LeaderboardResponse> {
    const { limit, ...request } = options;
    if (!WINDOWS.includes(window)) {
      throw new FomoError(`Invalid window "${window}". Expected one of ${WINDOWS.join(", ")}.`);
    }
    return this.request<LeaderboardResponse>(
      `/v2/leaderboard/${window}`,
      { limit: assertLimit(limit) },
      request,
    );
  }

  /** `GET /v2/leaderboard/tokens/{board}` - a honeypot-filtered token board
   * (`trending`, `most-held` or `graduated`). Needs an API key. */
  async tokenBoard(board: TokenBoard, options: LimitOptions = {}): Promise<TokenBoardResponse> {
    const { limit, ...request } = options;
    if (!BOARDS.includes(board)) {
      throw new FomoError(`Invalid board "${board}". Expected one of ${BOARDS.join(", ")}.`);
    }
    const raw = await this.request<unknown>(
      `/v2/leaderboard/tokens/${board}`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TokenBoardResponse>(raw, "tokens");
  }

  /** What FOMO users are actively trading right now. */
  async trending(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard("trending", options);
  }

  /** The tokens the most FOMO users are holding (FOMO's board is 25). */
  async mostHeld(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard("most-held", options);
  }

  /** FOMO's graduated-token board. */
  async graduated(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard("graduated", options);
  }

  /* ---------------------------------------------------------------- tokens */

  /** `GET /token/{address}/holders` - which tracked traders hold a token, a
   * smart-money signal rather than an anonymous holder list. */
  async holders(address: string, options: LimitOptions = {}): Promise<TokenHoldersResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/token/${encodeURIComponent(requireArg(address, "address"))}/holders`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TokenHoldersResponse>(raw, "holders");
  }

  /** `GET /v2/tokens/search` - token-only search by symbol or name. */
  async searchTokens(query: string, options: LimitOptions = {}): Promise<TokenSearchResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      "/v2/tokens/search",
      { q: requireArg(query, "query"), limit: assertLimit(limit) },
      request,
    );
    // The API answers with `results`; `tokens` keeps the field name honest.
    return normalizeList<TokenSearchResponse>(raw, "tokens", "results");
  }

  /** `GET /v2/search` - unified search over traders and tokens. Every result
   * carries a `type` field, so narrow with `result.type === "trader"`. */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { limit, type, ...request } = options;
    const raw = await this.request<unknown>(
      "/v2/search",
      { q: requireArg(query, "query"), type, limit: assertLimit(limit) },
      request,
    );
    return normalizeList<SearchResponse>(raw, "results");
  }

  /* ---------------------------------------------------------------- theses */

  /** `GET /v2/thesis` - recent theses across all coins. */
  async theses(options: ThesisFeedOptions = {}): Promise<ThesesResponse> {
    const { limit, chain, ...request } = options;
    const raw = await this.request<unknown>(
      "/v2/thesis",
      { limit: assertLimit(limit), chain: chain === undefined ? undefined : normalizeChain(chain) },
      request,
    );
    return normalizeList<ThesesResponse>(raw, "theses");
  }

  /** `GET /v2/thesis/token/{mint}` - the reasoning traders wrote about a coin. */
  async tokenTheses(mint: string, options: TokenThesesOptions = {}): Promise<ThesesResponse> {
    const { limit, network, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/thesis/token/${encodeURIComponent(requireArg(mint, "mint"))}`,
      { limit: assertLimit(limit, 200), network },
      request,
    );
    return normalizeList<ThesesResponse>(raw, "theses");
  }

  /** `GET /v2/thesis/user/{id}` - every thesis by one trader, newest first.
   * `id` is a handle or a FOMO userId. */
  async userTheses(id: string, options: UserThesesOptions = {}): Promise<ThesesResponse> {
    const { limit, chain, sort, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/thesis/user/${encodeHandle(id)}`,
      {
        limit: assertLimit(limit, 200),
        chain: chain === undefined ? undefined : normalizeChain(chain),
        sort,
      },
      request,
    );
    return normalizeList<ThesesResponse>(raw, "theses");
  }

  /** `GET /v2/thesis/user/{id}/token/{address}` - one trader on one token. */
  async userTokenTheses(
    id: string,
    address: string,
    options: LimitOptions = {},
  ): Promise<ThesesResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/thesis/user/${encodeHandle(id)}/token/${encodeURIComponent(requireArg(address, "address"))}`,
      { limit: assertLimit(limit, 200) },
      request,
    );
    return normalizeList<ThesesResponse>(raw, "theses");
  }

  /* -------------------------------------------------------------- activity */

  /** `GET /v2/alerts` - the full activity firehose (buys, sells, theses),
   * newest first. REST fallback for the socket. Works without a key. */
  async alerts(options: AlertsOptions = {}): Promise<AlertsResponse> {
    const { limit, type, chain, since, ...request } = options;
    const raw = await this.request<unknown>(
      "/v2/alerts",
      {
        limit: assertLimit(limit),
        type,
        chain: chain === undefined ? undefined : normalizeChain(chain),
        since: encodeSince(since),
      },
      request,
    );
    return normalizeList<AlertsResponse>(raw, "alerts");
  }

  /** `GET /v2/notifications` - FOMO mobile push notifications only: price
   * milestones, trade opens/closes, whale buys, follows. */
  async notifications(options: NotificationsOptions = {}): Promise<NotificationsResponse> {
    const { limit, notificationType, since, ...request } = options;
    const raw = await this.request<unknown>(
      "/v2/notifications",
      { limit: assertLimit(limit), notificationType, since: encodeSince(since) },
      request,
    );
    return normalizeList<NotificationsResponse>(raw, "notifications");
  }

  /* ------------------------------------------------------------------ http */

  /** Full URL for a path and query. Auth travels as a header, not here. */
  url(path: string, query?: Query): string {
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${suffix}${buildQuery(query)}`;
  }

  /**
   * Every REST method above funnels through here, and it doubles as the escape
   * hatch for endpoints this client doesn't wrap yet:
   *
   * ```ts
   * const { trades } = await fomo.request<{ trades: unknown[] }>("/trades", { user: "kaleo" });
   * ```
   */
  async request<T>(path: string, query?: Query, options: RequestOptions = {}): Promise<T> {
    const url = this.url(path, query);
    const headers: Record<string, string> = { ...this.baseHeaders, ...options.headers };
    if (this.apiKey) headers["authorization"] = `Bearer ${this.apiKey}`;

    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let timedOut = false;
      const controller = new AbortController();
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              controller.abort();
            }, timeoutMs)
          : undefined;
      const onCallerAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onCallerAbort, { once: true });

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
      } catch (cause) {
        if (options.signal?.aborted) {
          throw new FomoTimeoutError(`Request to ${url} was aborted`, { cause });
        }
        lastError = timedOut
          ? new FomoTimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`, { cause })
          : new FomoNetworkError(`Request to ${url} failed: ${describe(cause)}`, { cause });
        if (attempt < maxRetries) {
          await sleep(this.backoff(attempt), options.signal);
          continue;
        }
        throw lastError;
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", onCallerAbort);
      }

      const rateLimit = parseRateLimit(response.headers);
      if (rateLimit) {
        this.rateLimit = rateLimit;
        this.onRateLimit?.(rateLimit);
      }

      const body = await readBody(response);
      if (response.ok) return body as T;

      const retryAfterSeconds = rateLimit?.retryAfterSeconds;
      const error = httpErrorFor(
        errorMessage(response.status, body, response.statusText || "request failed"),
        {
          status: response.status,
          url,
          body,
          rateLimit,
          retryAfterSeconds,
          plan: pickString(body, "plan"),
        },
      );

      if (attempt < maxRetries && RETRY_STATUSES.has(response.status)) {
        const wait =
          retryAfterSeconds !== undefined
            ? Math.min(retryAfterSeconds * 1000, this.retryMaxDelayMs)
            : this.backoff(attempt);
        lastError = error;
        await sleep(wait, options.signal);
        continue;
      }

      throw error;
    }

    throw lastError ?? new FomoNetworkError(`Request to ${url} failed`);
  }

  /* -------------------------------------------------------------- realtime */

  /** The socket URL this client connects to, key and filters included. */
  get streamUrl(): string {
    const base = this.options.streamUrl ?? `${this.baseUrl.replace(/^http/, "ws")}/ws/alerts`;
    const params = new URLSearchParams();
    if (this.apiKey) params.set("key", this.apiKey);
    for (const [key, value] of Object.entries(this.streamFilters)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, key === "chain" ? normalizeChain(value as ChainFilter) : String(value));
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  /** Whether the socket is open. */
  get connected(): boolean {
    return this.socket !== undefined && this.socket.readyState === 1;
  }

  /** Currently applied server-side filters. */
  get filters(): Readonly<StreamFilters> {
    return { ...this.streamFilters };
  }

  /**
   * Iterate alerts as they arrive, connecting the socket on first use.
   *
   * ```ts
   * for await (const alert of fomo.stream({ chain: "robinhood", type: "buy" })) {
   *   console.log(alert.token, alert.usdValue);
   * }
   * ```
   *
   * Ends when {@link disconnect} is called, or when the socket drops with
   * `reconnect: false`. Breaking out of the loop disconnects.
   */
  stream(filters?: StreamFilters): AsyncIterableIterator<Alert> {
    if (filters && this.connected) this.subscribe(filters);
    else this.connect(filters);

    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next(): Promise<IteratorResult<Alert>> {
        const queued = self.queue.shift();
        if (queued) return Promise.resolve({ value: queued, done: false });
        if (self.disconnected) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<Alert>>((resolve) => {
          self.waiters.push(resolve);
        });
      },
      return(): Promise<IteratorResult<Alert>> {
        self.disconnect();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }

  /** Open the socket. A no-op while already connected or connecting. Pass
   * filters here, to {@link stream}, or to {@link subscribe} later. */
  connect(filters?: StreamFilters): this {
    if (filters) this.streamFilters = pickFilters(filters);
    if (this.socket) return this;
    this.disconnected = false;
    if (!this.welcomePromise) this.resetWelcome();

    const impl = this.options.webSocket ?? (globalThis as { WebSocket?: unknown }).WebSocket;
    if (!impl) {
      throw new FomoError(
        "No WebSocket implementation found. Pass `webSocket` (e.g. from the `ws` package) or run on Node 22+/a browser.",
      );
    }

    let socket: WebSocketLike;
    try {
      socket = new (impl as WebSocketConstructor)(this.streamUrl);
    } catch (cause) {
      this.emit("error", asError(cause, "Failed to open the alert stream"));
      this.scheduleReconnect();
      return this;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.armStaleTimer();
      this.emit("open");
    };
    socket.onmessage = (event) => {
      this.armStaleTimer();
      this.handleFrame(event.data);
    };
    socket.onerror = (event) => {
      this.emit("error", asError(event, "Alert stream error"));
    };
    socket.onclose = (event) => {
      this.socket = undefined;
      this.clearStaleTimer();
      const willReconnect = !this.disconnected && this.options.reconnect !== false;
      this.emit("close", { code: event?.code, reason: event?.reason, willReconnect });
      if (willReconnect) {
        this.scheduleReconnect();
      } else {
        this.finishIteration();
        this.rejectWelcome?.(new FomoError("Alert stream closed before the welcome message"));
      }
    };
    return this;
  }

  /** Resolves with the socket's welcome frame - the authoritative answer on
   * whether this connection is realtime or delayed. */
  welcome(): Promise<WelcomeMessage> {
    if (!this.welcomePromise) this.resetWelcome();
    return this.welcomePromise as Promise<WelcomeMessage>;
  }

  /** Change the filter set without reconnecting.
   *
   * The server replies `{type:"subscribed"}` and replays that filter's recent
   * alerts. Filters also survive reconnects. */
  subscribe(filters: StreamFilters): this {
    this.streamFilters = pickFilters(filters);
    const payload: Record<string, string> = { action: "subscribe" };
    for (const [key, value] of Object.entries(this.streamFilters)) {
      if (value === undefined || value === null || value === "") continue;
      payload[key] = key === "chain" ? normalizeChain(value as ChainFilter) : String(value);
    }
    return this.send(payload);
  }

  /** Drop all filters and go back to the full firehose. */
  unsubscribe(): this {
    this.streamFilters = {};
    return this.send({ action: "unsubscribe" });
  }

  /** Send a raw action frame. Silently skipped while disconnected - the filter
   * set is reapplied through the URL on the next connect. */
  send(payload: Record<string, unknown>): this {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(payload));
    }
    return this;
  }

  /** Close the socket for good and end any `for await` loop. REST calls keep
   * working; {@link connect} or {@link stream} opens a new socket. */
  disconnect(code?: number, reason?: string): this {
    this.disconnected = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.clearStaleTimer();
    try {
      this.socket?.close(code, reason);
    } catch {
      /* already gone */
    }
    this.socket = undefined;
    this.finishIteration();
    return this;
  }

  on<K extends keyof StreamEvents>(event: K, listener: StreamEvents[K]): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: never[]) => void);
    return this;
  }

  off<K extends keyof StreamEvents>(event: K, listener: StreamEvents[K]): this {
    this.listeners.get(event)?.delete(listener as (...args: never[]) => void);
    return this;
  }

  once<K extends keyof StreamEvents>(event: K, listener: StreamEvents[K]): this {
    const wrapped = ((...args: unknown[]) => {
      this.off(event, wrapped as StreamEvents[K]);
      (listener as (...a: unknown[]) => void)(...args);
    }) as StreamEvents[K];
    return this.on(event, wrapped);
  }

  /* ------------------------------------------------------------- internals */

  private backoff(attempt: number): number {
    const exponential = this.retryBaseMs * 2 ** attempt;
    const jittered = exponential * (0.5 + Math.random() / 2);
    return Math.min(jittered, this.retryMaxDelayMs);
  }

  private handleFrame(data: unknown): void {
    let message: StreamMessage;
    try {
      message = JSON.parse(typeof data === "string" ? data : String(data)) as StreamMessage;
    } catch (cause) {
      this.emit("error", asError(cause, "Received a non-JSON frame on the alert stream"));
      return;
    }

    this.emit("message", message);

    if (message.type === "welcome") {
      const welcome = message as WelcomeMessage;
      this.realtime = welcome.realtime;
      this.delaySeconds = welcome.delaySeconds;
      this.resolveWelcome?.(welcome);
      this.emit("welcome", welcome);
      return;
    }
    if (message.type === "subscribed") {
      this.emit("subscribed", message as SubscribedMessage);
      return;
    }
    if (isAlertFrame(message)) {
      const alert = message as unknown as Alert;
      if (this.options.skipReplay && alert.replay) return;
      this.emit("alert", alert);
      this.push(alert);
    }
  }

  private push(alert: Alert): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: alert, done: false });
      return;
    }
    const max = this.options.maxQueue ?? 1000;
    this.queue.push(alert);
    while (this.queue.length > max) {
      this.queue.shift();
      this.droppedAlerts++;
    }
  }

  private finishIteration(): void {
    while (this.waiters.length) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  private scheduleReconnect(): void {
    const max = this.options.maxReconnectAttempts ?? Number.POSITIVE_INFINITY;
    if (this.disconnected || this.attempts >= max) {
      this.finishIteration();
      return;
    }
    const base = this.options.reconnectBaseMs ?? 1000;
    const ceiling = this.options.reconnectMaxDelayMs ?? 30_000;
    const exponential = base * 2 ** this.attempts;
    const delayMs = Math.min(exponential * (0.5 + Math.random() / 2), ceiling);
    this.attempts++;
    this.emit("reconnecting", { attempt: this.attempts, delayMs });
    this.resetWelcome();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delayMs);
    unref(this.reconnectTimer);
  }

  private resetWelcome(): void {
    this.welcomePromise = new Promise<WelcomeMessage>((resolve, reject) => {
      this.resolveWelcome = resolve;
      this.rejectWelcome = reject;
    });
    // Nothing awaits this promise by default; keep it from becoming an
    // unhandled rejection when the socket closes first.
    this.welcomePromise.catch(() => undefined);
  }

  private armStaleTimer(): void {
    const timeout = this.options.staleTimeoutMs ?? 0;
    this.clearStaleTimer();
    if (timeout <= 0) return;
    this.staleTimer = setTimeout(() => {
      this.emit("error", new FomoError(`No alert received for ${timeout}ms; reconnecting`));
      try {
        this.socket?.close(4000, "stale");
      } catch {
        /* ignore */
      }
    }, timeout);
    unref(this.staleTimer);
  }

  private clearStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = undefined;
  }

  private emit<K extends keyof StreamEvents>(
    event: K,
    ...args: Parameters<StreamEvents[K]>
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as (...a: Parameters<StreamEvents[K]>) => void)(...args);
      } catch (cause) {
        if (event !== "error") {
          this.emit("error", asError(cause, `Listener for "${String(event)}" threw`));
        }
      }
    }
  }
}

/* ==========================================================================
 * Helpers
 * ========================================================================== */

function requireArg(value: string, name: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new FomoError(`\`${name}\` is required`);
  return trimmed;
}

/** Handles are case-insensitive and may carry a leading `@`. */
export function encodeHandle(handle: string): string {
  return encodeURIComponent(requireArg(handle, "handle").replace(/^@+/, ""));
}

function assertLimit(limit: number | undefined, max = 100): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new FomoError(`\`limit\` must be an integer between 1 and ${max}, got ${limit}`);
  }
  return limit;
}

function encodeSince(since: string | number | Date | undefined): string | number | undefined {
  if (since === undefined) return undefined;
  return since instanceof Date ? since.toISOString() : since;
}

/** Fill in the array and `available` flag so callers never branch on `undefined`. */
function normalizeList<T>(raw: unknown, key: string, ...aliases: string[]): T {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = [key, ...aliases].map((name) => record[name]).find(Array.isArray);
  return {
    ...record,
    available: record["available"] === undefined ? true : Boolean(record["available"]),
    [key]: items ?? [],
  } as T;
}

export function buildQuery(query: Query | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function toInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRateLimit(headers: Headers): RateLimit | undefined {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const window = headers.get("x-ratelimit-window");
  const retryAfter = parseRetryAfter(headers.get("retry-after"));
  if (limit === null && remaining === null && window === null && retryAfter === undefined) {
    return undefined;
  }
  const rateLimit: RateLimit = {
    limit: toInt(limit),
    remaining: toInt(remaining),
    window,
  };
  if (retryAfter !== undefined) rateLimit.retryAfterSeconds = retryAfter;
  return rateLimit;
}

/** `retry-after` is either delay-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, (date - Date.now()) / 1000);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const detail = record["error"] ?? record["message"];
    if (typeof detail === "string" && detail) return `${status} ${detail}`;
  }
  return `${status} ${fallback}`;
}

function pickString(body: unknown, key: string): string | undefined {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new FomoTimeoutError("Request aborted before retry"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new FomoTimeoutError("Request aborted before retry"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function pickFilters(source: StreamFilters): StreamFilters {
  const filters: StreamFilters = {};
  if (source.trader !== undefined) filters.trader = source.trader.replace(/^@+/, "");
  if (source.token !== undefined) filters.token = source.token;
  if (source.chain !== undefined) filters.chain = source.chain;
  if (source.type !== undefined) filters.type = source.type;
  if (source.source !== undefined) filters.source = source.source;
  return filters;
}

/** Alert frames arrive as `{type:"alert", ...}`; be tolerant of payloads that
 * carry the alert kind (`buy`, `sell`, `thesis`) in `type` instead. */
function isAlertFrame(message: StreamMessage): boolean {
  if (message.type === "alert") return true;
  const record = message as Record<string, unknown>;
  return typeof record["id"] === "string" && typeof record["ts"] === "number";
}

function asError(cause: unknown, fallback: string): Error {
  if (cause instanceof Error) return cause;
  if (cause && typeof cause === "object") {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string") return new FomoError(message, { cause });
  }
  return new FomoError(fallback, { cause });
}

/** Keep a pending timer from holding the Node event loop open. */
function unref(timer: unknown): void {
  const maybe = timer as { unref?: () => void };
  if (typeof maybe?.unref === "function") maybe.unref();
}
