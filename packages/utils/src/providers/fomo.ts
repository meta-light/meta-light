import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

/* Who we are and what the plan allows.
 *
 * FOMO sends no `x-ratelimit-*` headers, so these numbers are the only budget
 * we have: everything is metered locally in usage.json (see budget.ts). */

/** Your FOMO handle. Used to exclude yourself from the copy list - copying
 * your own fills is a feedback loop, not a strategy. */
export const MY_HANDLE = '0xMetaLight';

/* The accounts you follow on FOMO, hardcoded.
 *
 * Not a choice about caching: FOMO's API has no follow graph. There is no
 * endpoint that answers "who does @0xMetaLight follow" - a trader carries a
 * `followers` count and no `following` list, and `/v2/users/me` is read as the
 * literal handle `me`. So the roster crosses over from the app by hand.
 *
 * Edit this list to change who is watched. follows.json, if it exists, layers
 * per-trader copy settings (weight, caps, mute) on top without duplicating the
 * roster - see followRoster() in follows.ts. */
export const FOLLOWING: readonly string[] = [
  'JamesChristoph', // James Christoph
  'fejau_inc', //      fejau
  'AvgJoesCrypto', //  AJC
  'smyyguy', //        Dan Smith
  'EffortCapital', //  David
  'WestieCapital', //  Westie (rev/acc)
];

/** Free-plan quotas, as published on the dashboard. */
export const PLAN = {
  requestsPerMonth: 10_000,
  requestsPerMinute: 60,
  /** handle -> wallet lookups, i.e. `GET /v2/users/{handle}`. The scarcest
   * resource by three orders of magnitude, and it never resets mid-month. */
  walletResolutionsPerMonth: 25,
} as const;

/** Headroom kept in reserve so a burst can never trip the real limit:
 * we stop at 9800/month and pace to 50/minute. */
export const RESERVE = {
  requestsPerMonth: 200,
  requestsPerMinute: 10,
} as const;

export const USAGE_FILE = 'usage.json';
export const TRADER_CACHE_FILE = 'cache/traders.json';

/**
 * fomoapi - a single-file TypeScript client for the FOMO API (https://fomoapi.io).
 *
 * Everything lives here: the response types, the error hierarchy, the chain
 * helpers, and one `FomoClient` class that owns both the REST surface and the
 * realtime alert socket.
 *
 * ```ts
 * import { FomoClient } from "@meta-light/utils/src/providers/fomo";
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

export type LeaderboardWindow = '24h' | '7d' | '30d' | 'all';

/** Token board exposed under `/v2/leaderboard/tokens/*`. */
export type TokenBoard = 'trending' | 'most-held' | 'graduated';

/** Chain filter accepted by the alert, thesis and stream endpoints: a friendly
 * name, an alias (`hood`, `rh`), or a raw chain id. */
export type ChainFilter = string | number;

/** Rate-limit state parsed from `x-ratelimit-*` response headers. */
export interface RateLimit {
  /** Your ceiling: requests per minute (keyless) or per month (keyed). */
  limit: number | null;
  remaining: number | null;
  /** `"month"` for keyed requests, minute-based for anonymous ones. */
  window: string | null;
  /** From `retry-after`, present on a 429. */
  retryAfterSeconds?: number;
}

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

/** A trader's real main wallets. `status: "resolving"` means the main wallet is
 * still being indexed (FOMO only exposes a throwaway signer wallet, which this
 * API never surfaces). */
export interface Wallets {
  solana?: string | null;
  evm?: string | null;
  status?: 'resolving' | string;
}

/** PnL in USD per ranking window. */
export interface PnlByWindow {
  '24h'?: number;
  '7d'?: number;
  '30d'?: number;
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
  side?: 'buy' | 'sell' | string;
  sizeUsd?: number;
  status?: 'open' | 'closed' | string;
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
  source?: 'captured' | 'feed' | string;
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
  isDev?: boolean;
  status?: string;
  createdAt?: string;
  closedAt?: string | null;
}

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

export interface Thesis {
  text: string;
  handle?: string;
  /** Display name. */
  name?: string;
  userId?: string;
  /** The author's position value, in USD. */
  equity?: number;
  /** Size of the trade, in USD. */
  tradeUsd?: number;
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

export interface TraderSearchResult extends Trader {
  type: 'trader';
}

export interface TokenSearchResult {
  type: 'token';
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

export type AlertType =
  | 'buy'
  | 'sell'
  | 'thesis'
  | 'whale'
  | 'price'
  | 'trade'
  | 'follow'
  | (string & {});

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
  type?: AlertType | 'alert';
  alertType?: AlertType;
  /** `true` on the backlog the socket replays right after connecting or
   * subscribing. Skip these when an alert must trigger an action. */
  replay?: boolean;
  /** `"feed"` for activity, `"push"` for a captured mobile push notification. */
  source?: 'feed' | 'push' | (string & {});
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

/** First message on a WebSocket connection: whether you are getting realtime. */
export interface WelcomeMessage {
  type: 'welcome';
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
  type: 'subscribed';
  filter?: Record<string, string>;
  [key: string]: unknown;
}

export type StreamMessage =
  | WelcomeMessage
  | SubscribedMessage
  | ({ type: 'alert' } & Alert)
  | ({ type: string } & Record<string, unknown>);

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

function httpErrorFor(
  message: string,
  init: FomoHttpErrorInit & { retryAfterSeconds?: number; plan?: string },
): FomoHttpError {
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
  hood: 'robinhood',
  rh: 'robinhood',
  robinhood: 'robinhood',
  sol: 'solana',
  solana: 'solana',
  eth: 'eth',
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  bnb: 'bsc',
  polygon: 'polygon',
  matic: 'polygon',
  arbitrum: 'arbitrum',
  arb: 'arbitrum',
};

/** Resolve a chain name, alias or raw id to the string the API expects.
 * Unknown values pass through untouched - the API accepts raw chain ids. */
export function normalizeChain(chain: ChainFilter): string {
  if (typeof chain === 'number') return String(chain);
  const key = chain.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

export function chainId(chain: string): number | undefined {
  const name = ALIASES[chain.trim().toLowerCase()];
  return name ? CHAIN_IDS[name] : undefined;
}

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
  if (alert.type && alert.type !== 'alert') return alert.type;
  return undefined;
}

export function isPush(alert: Alert): boolean {
  return alert.source === 'push';
}

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
  source?: 'feed' | 'push';
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
  headers?: Record<string, string>;
  /** Override the fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Called after every response that carried `x-ratelimit-*` headers. */
  onRateLimit?: (rateLimit: RateLimit) => void;

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

export interface RequestOptions {
  /** Abort the request (and any pending retry). */
  signal?: AbortSignal;
  timeoutMs?: number;
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
  network?: 'sol' | 'bnb' | 'base' | 'eth';
}

export interface UserThesesOptions extends ThesisFeedOptions {
  /** `likes` = most-liked first, `recent` = newest first. */
  sort?: 'likes' | 'recent';
}

export interface SearchOptions extends LimitOptions {
  /** Restrict the result set. Defaults to `all` server-side. */
  type?: 'traders' | 'tokens' | 'all';
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

export interface StreamEvents {
  open: () => void;
  welcome: (message: WelcomeMessage) => void;
  alert: (alert: Alert) => void;
  subscribed: (message: SubscribedMessage) => void;
  /** Every decoded frame, including welcome and alerts. */
  message: (message: StreamMessage) => void;
  error: (error: Error) => void;
  close: (info: {
    code?: number;
    reason?: string;
    willReconnect: boolean;
  }) => void;
  reconnecting: (info: { attempt: number; delayMs: number }) => void;
}

const DEFAULT_BASE_URL = 'https://api.fomoapi.io';
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const WINDOWS: readonly LeaderboardWindow[] = ['24h', '7d', '30d', 'all'];
const BOARDS: readonly TokenBoard[] = ['trending', 'most-held', 'graduated'];

/**
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

  private readonly listeners = new Map<
    keyof StreamEvents,
    Set<(...args: never[]) => void>
  >();
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
    const fetchImpl =
      options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new FomoNetworkError(
        'No fetch implementation found. Pass `fetch` in the client options (Node 18+ has it built in).',
      );
    }
    this.options = options;
    this.fetchImpl = fetchImpl;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 20_000;
    this.baseHeaders = { accept: 'application/json', ...options.headers };
    this.onRateLimit = options.onRateLimit;
  }

  /** Whether an API key was configured. Data endpoints 401 without one. */
  get authenticated(): boolean {
    return Boolean(this.apiKey);
  }

  /** `GET /v1` - version, tier, rate limit, dataset size and endpoint catalog. */
  async info(options?: RequestOptions): Promise<ApiInfo> {
    return this.request<ApiInfo>('/v1', undefined, options);
  }

  /** `GET /health` - liveness, loaded trader count, process uptime. */
  async health(options?: RequestOptions): Promise<Health> {
    return this.request<Health>('/health', undefined, options);
  }

  /** `GET /v2/users/{handle}` - resolve a handle to both wallets, verified PnL
   * and stats. Case-insensitive, a leading `@` is fine. Throws
   * {@link FomoNotFoundError} when the handle isn't in the dataset. */
  async trader(handle: string, options?: RequestOptions): Promise<Trader> {
    return this.request<Trader>(
      `/v2/users/${encodeHandle(handle)}`,
      undefined,
      options,
    );
  }

  /** `GET /v2/users/{handle}/trades` - trade history for copy-trading.
   * `available: false` (with an empty array) until the trader is captured. */
  async trades(
    handle: string,
    options: LimitOptions = {},
  ): Promise<TradesResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/users/${encodeHandle(handle)}/trades`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TradesResponse>(raw, 'trades');
  }

  /** `GET /v2/users/{handle}/balances` - the live portfolio, for mirroring
   * positions. `available: false` until the trader is captured. */
  async balances(
    handle: string,
    options: RequestOptions = {},
  ): Promise<BalancesResponse> {
    const raw = await this.request<unknown>(
      `/v2/users/${encodeHandle(handle)}/balances`,
      undefined,
      options,
    );
    return normalizeList<BalancesResponse>(raw, 'holdings');
  }

  /** `GET /v2/trades/{tradeId}` - swaps, transfers, average entry/exit,
   * realized PnL and whether the trader is the token dev. */
  async trade(tradeId: string, options?: RequestOptions): Promise<TradeDetail> {
    return this.request<TradeDetail>(
      `/v2/trades/${encodeURIComponent(requireArg(tradeId, 'tradeId'))}`,
      undefined,
      options,
    );
  }

  /** `GET /v2/leaderboard/{window}` - traders ranked by verified PnL over
   * `24h`, `7d`, `30d` or `all`. Works without an API key. */
  async leaderboard(
    window: LeaderboardWindow,
    options: LimitOptions = {},
  ): Promise<LeaderboardResponse> {
    const { limit, ...request } = options;
    if (!WINDOWS.includes(window)) {
      throw new FomoError(
        `Invalid window "${window}". Expected one of ${WINDOWS.join(', ')}.`,
      );
    }
    return this.request<LeaderboardResponse>(
      `/v2/leaderboard/${window}`,
      { limit: assertLimit(limit) },
      request,
    );
  }

  /** `GET /v2/leaderboard/tokens/{board}` - a honeypot-filtered token board
   * (`trending`, `most-held` or `graduated`). Needs an API key. */
  async tokenBoard(
    board: TokenBoard,
    options: LimitOptions = {},
  ): Promise<TokenBoardResponse> {
    const { limit, ...request } = options;
    if (!BOARDS.includes(board)) {
      throw new FomoError(
        `Invalid board "${board}". Expected one of ${BOARDS.join(', ')}.`,
      );
    }
    const raw = await this.request<unknown>(
      `/v2/leaderboard/tokens/${board}`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TokenBoardResponse>(raw, 'tokens');
  }

  async trending(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard('trending', options);
  }

  /** The tokens the most FOMO users are holding (FOMO's board is 25). */
  async mostHeld(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard('most-held', options);
  }

  async graduated(options?: LimitOptions): Promise<TokenBoardResponse> {
    return this.tokenBoard('graduated', options);
  }

  /** `GET /token/{address}/holders` - which tracked traders hold a token, a
   * smart-money signal rather than an anonymous holder list. */
  async holders(
    address: string,
    options: LimitOptions = {},
  ): Promise<TokenHoldersResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/token/${encodeURIComponent(requireArg(address, 'address'))}/holders`,
      { limit: assertLimit(limit) },
      request,
    );
    return normalizeList<TokenHoldersResponse>(raw, 'holders');
  }

  /** `GET /v2/tokens/search` - token-only search by symbol or name. */
  async searchTokens(
    query: string,
    options: LimitOptions = {},
  ): Promise<TokenSearchResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      '/v2/tokens/search',
      { q: requireArg(query, 'query'), limit: assertLimit(limit) },
      request,
    );
    // The API answers with `results`; `tokens` keeps the field name honest.
    return normalizeList<TokenSearchResponse>(raw, 'tokens', 'results');
  }

  /** `GET /v2/search` - unified search over traders and tokens. Every result
   * carries a `type` field, so narrow with `result.type === "trader"`. */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    const { limit, type, ...request } = options;
    const raw = await this.request<unknown>(
      '/v2/search',
      { q: requireArg(query, 'query'), type, limit: assertLimit(limit) },
      request,
    );
    return normalizeList<SearchResponse>(raw, 'results');
  }

  /** `GET /v2/thesis` - recent theses across all coins. */
  async theses(options: ThesisFeedOptions = {}): Promise<ThesesResponse> {
    const { limit, chain, ...request } = options;
    const raw = await this.request<unknown>(
      '/v2/thesis',
      {
        limit: assertLimit(limit),
        chain: chain === undefined ? undefined : normalizeChain(chain),
      },
      request,
    );
    return normalizeList<ThesesResponse>(raw, 'theses');
  }

  /** `GET /v2/thesis/token/{mint}` - the reasoning traders wrote about a coin. */
  async tokenTheses(
    mint: string,
    options: TokenThesesOptions = {},
  ): Promise<ThesesResponse> {
    const { limit, network, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/thesis/token/${encodeURIComponent(requireArg(mint, 'mint'))}`,
      { limit: assertLimit(limit, 200), network },
      request,
    );
    return normalizeList<ThesesResponse>(raw, 'theses');
  }

  /** `GET /v2/thesis/user/{id}` - every thesis by one trader, newest first.
   * `id` is a handle or a FOMO userId. */
  async userTheses(
    id: string,
    options: UserThesesOptions = {},
  ): Promise<ThesesResponse> {
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
    return normalizeList<ThesesResponse>(raw, 'theses');
  }

  /** `GET /v2/thesis/user/{id}/token/{address}` - one trader on one token. */
  async userTokenTheses(
    id: string,
    address: string,
    options: LimitOptions = {},
  ): Promise<ThesesResponse> {
    const { limit, ...request } = options;
    const raw = await this.request<unknown>(
      `/v2/thesis/user/${encodeHandle(id)}/token/${encodeURIComponent(requireArg(address, 'address'))}`,
      { limit: assertLimit(limit, 200) },
      request,
    );
    return normalizeList<ThesesResponse>(raw, 'theses');
  }

  /** `GET /v2/alerts` - the full activity firehose (buys, sells, theses),
   * newest first. REST fallback for the socket. Works without a key. */
  async alerts(options: AlertsOptions = {}): Promise<AlertsResponse> {
    const { limit, type, chain, since, ...request } = options;
    const raw = await this.request<unknown>(
      '/v2/alerts',
      {
        limit: assertLimit(limit),
        type,
        chain: chain === undefined ? undefined : normalizeChain(chain),
        since: encodeSince(since),
      },
      request,
    );
    return normalizeList<AlertsResponse>(raw, 'alerts');
  }

  /** `GET /v2/notifications` - FOMO mobile push notifications only: price
   * milestones, trade opens/closes, whale buys, follows. */
  async notifications(
    options: NotificationsOptions = {},
  ): Promise<NotificationsResponse> {
    const { limit, notificationType, since, ...request } = options;
    const raw = await this.request<unknown>(
      '/v2/notifications',
      {
        limit: assertLimit(limit),
        notificationType,
        since: encodeSince(since),
      },
      request,
    );
    return normalizeList<NotificationsResponse>(raw, 'notifications');
  }

  /** Full URL for a path and query. Auth travels as a header, not here. */
  url(path: string, query?: Query): string {
    const suffix = path.startsWith('/') ? path : `/${path}`;
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
  async request<T>(
    path: string,
    query?: Query,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.url(path, query);
    const headers: Record<string, string> = {
      ...this.baseHeaders,
      ...options.headers,
    };
    if (this.apiKey) headers['authorization'] = `Bearer ${this.apiKey}`;

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
      options.signal?.addEventListener('abort', onCallerAbort, { once: true });

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } catch (cause) {
        if (options.signal?.aborted) {
          throw new FomoTimeoutError(`Request to ${url} was aborted`, {
            cause,
          });
        }
        lastError = timedOut
          ? new FomoTimeoutError(
              `Request to ${url} timed out after ${timeoutMs}ms`,
              { cause },
            )
          : new FomoNetworkError(
              `Request to ${url} failed: ${describe(cause)}`,
              { cause },
            );
        if (attempt < maxRetries) {
          await sleep(this.backoff(attempt), options.signal);
          continue;
        }
        throw lastError;
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', onCallerAbort);
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
        errorMessage(
          response.status,
          body,
          response.statusText || 'request failed',
        ),
        {
          status: response.status,
          url,
          body,
          rateLimit,
          retryAfterSeconds,
          plan: pickString(body, 'plan'),
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

  /** The socket URL this client connects to, key and filters included. */
  get streamUrl(): string {
    const base =
      this.options.streamUrl ??
      `${this.baseUrl.replace(/^http/, 'ws')}/ws/alerts`;
    const params = new URLSearchParams();
    if (this.apiKey) params.set('key', this.apiKey);
    for (const [key, value] of Object.entries(this.streamFilters)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(
        key,
        key === 'chain' ? normalizeChain(value as ChainFilter) : String(value),
      );
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  get connected(): boolean {
    return this.socket !== undefined && this.socket.readyState === 1;
  }

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
        if (self.disconnected)
          return Promise.resolve({ value: undefined, done: true });
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

    const impl =
      this.options.webSocket ??
      (globalThis as { WebSocket?: unknown }).WebSocket;
    if (!impl) {
      throw new FomoError(
        'No WebSocket implementation found. Pass `webSocket` (e.g. from the `ws` package) or run on Node 22+/a browser.',
      );
    }

    let socket: WebSocketLike;
    try {
      socket = new (impl as WebSocketConstructor)(this.streamUrl);
    } catch (cause) {
      this.emit('error', asError(cause, 'Failed to open the alert stream'));
      this.scheduleReconnect();
      return this;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.armStaleTimer();
      this.emit('open');
    };
    socket.onmessage = (event) => {
      this.armStaleTimer();
      this.handleFrame(event.data);
    };
    socket.onerror = (event) => {
      this.emit('error', asError(event, 'Alert stream error'));
    };
    socket.onclose = (event) => {
      this.socket = undefined;
      this.clearStaleTimer();
      const willReconnect =
        !this.disconnected && this.options.reconnect !== false;
      this.emit('close', {
        code: event?.code,
        reason: event?.reason,
        willReconnect,
      });
      if (willReconnect) {
        this.scheduleReconnect();
      } else {
        this.finishIteration();
        this.rejectWelcome?.(
          new FomoError('Alert stream closed before the welcome message'),
        );
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
    const payload: Record<string, string> = { action: 'subscribe' };
    for (const [key, value] of Object.entries(this.streamFilters)) {
      if (value === undefined || value === null || value === '') continue;
      payload[key] =
        key === 'chain' ? normalizeChain(value as ChainFilter) : String(value);
    }
    return this.send(payload);
  }

  unsubscribe(): this {
    this.streamFilters = {};
    return this.send({ action: 'unsubscribe' });
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

  once<K extends keyof StreamEvents>(
    event: K,
    listener: StreamEvents[K],
  ): this {
    const wrapped = ((...args: unknown[]) => {
      this.off(event, wrapped as StreamEvents[K]);
      (listener as (...a: unknown[]) => void)(...args);
    }) as StreamEvents[K];
    return this.on(event, wrapped);
  }

  private backoff(attempt: number): number {
    const exponential = this.retryBaseMs * 2 ** attempt;
    const jittered = exponential * (0.5 + Math.random() / 2);
    return Math.min(jittered, this.retryMaxDelayMs);
  }

  private handleFrame(data: unknown): void {
    let message: StreamMessage;
    try {
      message = JSON.parse(
        typeof data === 'string' ? data : String(data),
      ) as StreamMessage;
    } catch (cause) {
      this.emit(
        'error',
        asError(cause, 'Received a non-JSON frame on the alert stream'),
      );
      return;
    }

    this.emit('message', message);

    if (message.type === 'welcome') {
      const welcome = message as WelcomeMessage;
      this.realtime = welcome.realtime;
      this.delaySeconds = welcome.delaySeconds;
      this.resolveWelcome?.(welcome);
      this.emit('welcome', welcome);
      return;
    }
    if (message.type === 'subscribed') {
      this.emit('subscribed', message as SubscribedMessage);
      return;
    }
    if (isAlertFrame(message)) {
      const alert = message as unknown as Alert;
      if (this.options.skipReplay && alert.replay) return;
      this.emit('alert', alert);
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
    this.emit('reconnecting', { attempt: this.attempts, delayMs });
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
      this.emit(
        'error',
        new FomoError(`No alert received for ${timeout}ms; reconnecting`),
      );
      try {
        this.socket?.close(4000, 'stale');
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
        if (event !== 'error') {
          this.emit(
            'error',
            asError(cause, `Listener for "${String(event)}" threw`),
          );
        }
      }
    }
  }
}

function requireArg(value: string, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new FomoError(`\`${name}\` is required`);
  return trimmed;
}

/** Handles are case-insensitive and may carry a leading `@`. */
export function encodeHandle(handle: string): string {
  return encodeURIComponent(requireArg(handle, 'handle').replace(/^@+/, ''));
}

function assertLimit(limit: number | undefined, max = 100): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new FomoError(
      `\`limit\` must be an integer between 1 and ${max}, got ${limit}`,
    );
  }
  return limit;
}

function encodeSince(
  since: string | number | Date | undefined,
): string | number | undefined {
  if (since === undefined) return undefined;
  return since instanceof Date ? since.toISOString() : since;
}

/** Fill in the array and `available` flag so callers never branch on `undefined`. */
function normalizeList<T>(raw: unknown, key: string, ...aliases: string[]): T {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const items = [key, ...aliases]
    .map((name) => record[name])
    .find(Array.isArray);
  return {
    ...record,
    available:
      record['available'] === undefined ? true : Boolean(record['available']),
    [key]: items ?? [],
  } as T;
}

export function buildQuery(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function toInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRateLimit(headers: Headers): RateLimit | undefined {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const window = headers.get('x-ratelimit-window');
  const retryAfter = parseRetryAfter(headers.get('retry-after'));
  if (
    limit === null &&
    remaining === null &&
    window === null &&
    retryAfter === undefined
  ) {
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
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const detail = record['error'] ?? record['message'];
    if (typeof detail === 'string' && detail) return `${status} ${detail}`;
  }
  return `${status} ${fallback}`;
}

function pickString(body: unknown, key: string): string | undefined {
  if (body && typeof body === 'object') {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new FomoTimeoutError('Request aborted before retry'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new FomoTimeoutError('Request aborted before retry'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function pickFilters(source: StreamFilters): StreamFilters {
  const filters: StreamFilters = {};
  if (source.trader !== undefined)
    filters.trader = source.trader.replace(/^@+/, '');
  if (source.token !== undefined) filters.token = source.token;
  if (source.chain !== undefined) filters.chain = source.chain;
  if (source.type !== undefined) filters.type = source.type;
  if (source.source !== undefined) filters.source = source.source;
  return filters;
}

/** Alert frames arrive as `{type:"alert", ...}`; be tolerant of payloads that
 * carry the alert kind (`buy`, `sell`, `thesis`) in `type` instead. */
function isAlertFrame(message: StreamMessage): boolean {
  if (message.type === 'alert') return true;
  const record = message as Record<string, unknown>;
  return typeof record['id'] === 'string' && typeof record['ts'] === 'number';
}

function asError(cause: unknown, fallback: string): Error {
  if (cause instanceof Error) return cause;
  if (cause && typeof cause === 'object') {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === 'string') return new FomoError(message, { cause });
  }
  return new FomoError(fallback, { cause });
}

/** Keep a pending timer from holding the Node event loop open. */
function unref(timer: unknown): void {
  const maybe = timer as { unref?: () => void };
  if (typeof maybe?.unref === 'function') maybe.unref();
}

/* Local metering for a 24/7 bot on a metered key.
 *
 * The API publishes no rate-limit headers, so we cannot discover our own
 * usage - we have to remember it. Budget wraps `fetch`, counts every request
 * before it leaves, and persists the ledger to usage.json so a restart (or a
 * crash loop) cannot double-spend the month.
 *
 * Three independent budgets, in order of scarcity:
 *
 *   25 wallet resolutions / month  - only `GET /v2/users/{handle}` spends one,
 *                                    and only for a handle not already spent
 *                                    this month. Refused locally when gone.
 *   60 requests / minute           - a sliding window; we pace, not fail.
 *   10K requests / month           - a hard stop with 200 held in reserve.
 */

/** Thrown instead of sending a request that would breach a quota. Nothing is
 * spent when this fires - it is the one error that costs nothing. */
export class BudgetError extends Error {
  readonly kind: 'month' | 'wallet';
  constructor(kind: 'month' | 'wallet', message: string) {
    super(message);
    this.name = 'BudgetError';
    this.kind = kind;
  }
}

interface Ledger {
  /** `YYYY-MM` in UTC; a change resets the monthly counters. */
  month: string;
  requests: number;
  /** Handles whose wallets we have already paid to resolve this month. */
  resolutions: string[];
  /** Set when the API tells us the wallet quota is gone, which can happen
   * before our own count reaches 25 (usage predating this ledger). */
  walletsExhausted: boolean;
  /** Every request we have refused, by kind, for the boot report. */
  refused: Record<string, number>;
  updatedAt: string;
}

const utcMonth = (at = new Date()): string => at.toISOString().slice(0, 7);

const EMPTY = (): Ledger => ({
  month: utcMonth(),
  requests: 0,
  resolutions: [],
  walletsExhausted: false,
  refused: {},
  updatedAt: new Date().toISOString(),
});

/** `/v2/users/{handle}` and nothing else - `/trades` and `/balances` are
 * served from captured data and cost no resolution (verified against the live
 * API with the quota already exhausted). */
export function walletResolutionHandle(url: string): string | undefined {
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0] ?? '';
  const match = /^\/v\d+\/users\/([^/]+)\/?$/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : undefined;
}

export interface BudgetOptions {
  file?: string;
  /** Skip persistence - for tests. */
  memoryOnly?: boolean;
  now?: () => number;
}

export class Budget {
  private readonly file: string;
  private readonly memoryOnly: boolean;
  private readonly now: () => number;
  private ledger: Ledger;
  /** Sliding one-minute window of request timestamps. Not persisted: a
   * restart takes longer than the window it would protect. */
  private readonly minute: number[] = [];

  constructor(options: BudgetOptions = {}) {
    this.file = options.file ?? USAGE_FILE;
    this.memoryOnly = options.memoryOnly ?? false;
    this.now = options.now ?? Date.now;
    this.ledger = this.memoryOnly ? EMPTY() : this.load();
  }

  private load(): Ledger {
    try {
      const parsed = JSON.parse(
        readFileSync(this.file, 'utf8'),
      ) as Partial<Ledger>;
      return {
        ...EMPTY(),
        ...parsed,
        resolutions: (parsed.resolutions ?? []).map((handle) =>
          handle.toLowerCase(),
        ),
        refused: parsed.refused ?? {},
      };
    } catch {
      // No ledger yet, or an unreadable one: start clean rather than refuse to
      // boot. The worst case is one month counted from zero.
      return EMPTY();
    }
  }

  private save(): void {
    if (this.memoryOnly) return;
    this.ledger.updatedAt = new Date(this.now()).toISOString();
    const directory = dirname(this.file);
    if (directory && directory !== '.')
      mkdirSync(directory, { recursive: true });
    // Write-then-rename, so a kill mid-write cannot leave a truncated ledger.
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.ledger, undefined, 2)}\n`);
    renameSync(temporary, this.file);
  }

  /** Month boundaries reset requests and resolutions together, including the
   * exhausted flag - the API's quota rolls on the same calendar. */
  private roll(): void {
    const month = utcMonth(new Date(this.now()));
    if (month === this.ledger.month) return;
    this.ledger = { ...EMPTY(), month, refused: {} };
    this.save();
  }

  private refuse(kind: 'month' | 'wallet', message: string): never {
    this.ledger.refused[kind] = (this.ledger.refused[kind] ?? 0) + 1;
    this.save();
    throw new BudgetError(kind, message);
  }

  get monthlyRemaining(): number {
    this.roll();
    return Math.max(
      0,
      PLAN.requestsPerMonth - RESERVE.requestsPerMonth - this.ledger.requests,
    );
  }

  get walletsRemaining(): number {
    this.roll();
    if (this.ledger.walletsExhausted) return 0;
    return Math.max(
      0,
      PLAN.walletResolutionsPerMonth - this.ledger.resolutions.length,
    );
  }

  /** True when this handle's wallets are already paid for this month, so
   * re-resolving it is free. */
  resolved(handle: string): boolean {
    this.roll();
    return this.ledger.resolutions.includes(handle.toLowerCase());
  }

  snapshot(): {
    month: string;
    requests: number;
    requestsRemaining: number;
    wallets: number;
    walletsRemaining: number;
    walletsExhausted: boolean;
    refused: Record<string, number>;
  } {
    this.roll();
    return {
      month: this.ledger.month,
      requests: this.ledger.requests,
      requestsRemaining: this.monthlyRemaining,
      wallets: this.ledger.resolutions.length,
      walletsRemaining: this.walletsRemaining,
      walletsExhausted: this.ledger.walletsExhausted,
      refused: { ...this.ledger.refused },
    };
  }

  /** Sleep just long enough that this request lands inside the per-minute
   * allowance. Pacing, not failing: a slow boot beats a 429. */
  private async pace(): Promise<void> {
    const ceiling = PLAN.requestsPerMinute - RESERVE.requestsPerMinute;
    for (;;) {
      const cutoff = this.now() - 60_000;
      while (this.minute.length > 0 && (this.minute[0] as number) <= cutoff)
        this.minute.shift();
      if (this.minute.length < ceiling) return;
      const oldest = this.minute[0] as number;
      // Poll in short hops rather than committing to one long sleep: the wall
      // clock can jump, and a caller that aborts should not be stuck for a
      // full minute waiting on a window that already cleared.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(500, Math.max(25, oldest - cutoff))),
      );
    }
  }

  /** Wrap a fetch so every call through it is metered. The client takes this
   * as its `fetch` option, which puts retries under the budget too. */
  wrap(inner: FetchLike): FetchLike {
    return async (url, init) => {
      this.roll();
      const handle = walletResolutionHandle(url);
      const fresh = handle !== undefined && !this.resolved(handle);

      if (this.monthlyRemaining <= 0) {
        this.refuse(
          'month',
          `Monthly request budget spent (${this.ledger.requests}/${PLAN.requestsPerMonth} in ${this.ledger.month}, ` +
            `${RESERVE.requestsPerMonth} held in reserve). Resets on the 1st UTC.`,
        );
      }
      if (fresh && this.walletsRemaining <= 0) {
        this.refuse(
          'wallet',
          `Wallet resolutions spent (${this.ledger.resolutions.length}/${PLAN.walletResolutionsPerMonth} in ` +
            `${this.ledger.month}). Refusing to resolve @${handle} - it would 429 anyway. ` +
            `Cached traders still work; the stream is unaffected.`,
        );
      }

      await this.pace();
      this.minute.push(this.now());
      this.ledger.requests += 1;
      if (fresh && handle) this.ledger.resolutions.push(handle);
      this.save();

      const response = await inner(url, init);

      // The API is the authority on the wallet quota; believe it over our count.
      if (response.status === 429 && handle) {
        const copy = response.clone();
        const body: unknown = await copy.json().catch(() => undefined);
        const error =
          typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)['error']
            : undefined;
        if (typeof error === 'string' && error.includes('wallet resolution')) {
          this.ledger.walletsExhausted = true;
          // A refused resolution was not actually granted - take it back.
          if (fresh)
            this.ledger.resolutions = this.ledger.resolutions.filter(
              (h) => h !== handle,
            );
          this.save();
        }
      }
      return response;
    };
  }
}

/** The metered fetch every entry point should hand to FomoClient. */
export function governedFetch(budget: Budget): FetchLike {
  const inner = globalThis.fetch as FetchLike | undefined;
  if (!inner) throw new Error('No global fetch - run on Node 18+');
  return budget.wrap(inner);
}

export function formatBudget(budget: Budget): string {
  const {
    month,
    requests,
    requestsRemaining,
    wallets,
    walletsRemaining,
    walletsExhausted,
  } = budget.snapshot();
  const walletLine = walletsExhausted
    ? `${PLAN.walletResolutionsPerMonth}/${PLAN.walletResolutionsPerMonth} spent (API says exhausted)`
    : `${wallets}/${PLAN.walletResolutionsPerMonth} spent, ${walletsRemaining} left`;
  return (
    `budget ${month}: requests ${requests}/${PLAN.requestsPerMonth} (${requestsRemaining} usable) | ` +
    `wallet resolutions ${walletLine}`
  );
}

/**
 * The follow list: who this bot copies.
 *
 * The FOMO API is keyed to an API key, not to your FOMO account, so it cannot
 * tell us who you follow (a trader exposes a `followers` count, never a
 * `following` list). The list therefore lives in `follows.json`, which you own.
 */


export const FOLLOWS_FILE = 'follows.json';

/** One followed account, as stored in `follows.json`. */
export interface Follow {
  /** FOMO handle, without the `@`. Matched case-insensitively against alerts. */
  handle: string;
  /** Position-size multiplier applied to the bot's base size. Default 1. */
  weight?: number;
  /** Hard per-signal ceiling in USD for this trader, overriding the global one. */
  maxUsd?: number;
  /** Only copy these chains for this trader. Omit to allow the bot's global set. */
  chains?: string[];
  /** Keep the row but stop copying. */
  mute?: boolean;
  /** Free-text reminder of why they are on the list. */
  note?: string;
}

export interface ResolvedFollow extends Follow {
  /** Whether this account should be copied. A throttled lookup stays `true` -
   * the handle is fine, we just could not enrich it right now. */
  ok: boolean;
  /** Why it failed, when `ok` is false. */
  reason?: string;
  /** Set when the row is copyable but unverified, e.g. a throttled lookup. */
  warning?: string;
  displayName?: string;
  /** PnL derived from onchain trades rather than self-reported. */
  verified?: boolean;
  pnlUsd?: number;
  pnl24h?: number;
  trades?: number;
  followers?: number;
  wallets?: Wallets;
  /** Their median hold time - how fast you have to be to copy them. */
  avgHoldSeconds?: number;
  /** Open / closed positions across their whole captured history. Comes from
   * `/trades`, which costs no wallet resolution, so this is the enrichment we
   * can afford on every boot. */
  activeCount?: number;
  closedCount?: number;
  /** When the wallet resolution behind `wallets`/`pnlUsd` was paid for. */
  verifiedAt?: string;
}

interface CachedActivity {
  checkedAt: string;
  available: boolean;
  activeCount?: number;
  closedCount?: number;
}

interface CachedTrader {
  /** When the wallet resolution was paid for. Absent if we only ever took the
   * free path for this handle. */
  fetchedAt?: string;
  trader?: Trader;
  /** The free `/trades` snapshot, re-checked on a TTL so a restarting bot
   * costs no requests. */
  activity?: CachedActivity;
}

/** Wallet resolutions are 25 a month and never come back, so a resolved trader
 * is cached to disk permanently and re-read on every boot. Deleting this file
 * throws away paid-for data. */
export function loadTraderCache(
  file = TRADER_CACHE_FILE,
): Map<string, CachedTrader> {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<
      string,
      CachedTrader
    >;
    return new Map(
      Object.entries(parsed).map(([handle, entry]) => [
        handle.toLowerCase(),
        entry,
      ]),
    );
  } catch {
    return new Map();
  }
}

export function saveTraderCache(
  cache: Map<string, CachedTrader>,
  file = TRADER_CACHE_FILE,
): void {
  const directory = dirname(file);
  if (directory && directory !== '.') mkdirSync(directory, { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify(Object.fromEntries(cache), null, 2)}\n`,
  );
}

function fromActivity(
  follow: Follow,
  activity: CachedActivity,
): ResolvedFollow {
  return {
    ...follow,
    ok: true,
    ...(activity.activeCount === undefined
      ? {}
      : { activeCount: activity.activeCount }),
    ...(activity.closedCount === undefined
      ? {}
      : { closedCount: activity.closedCount }),
    ...(activity.available
      ? {}
      : { warning: 'no captured trades - unverified' }),
  };
}

function fromTrader(
  follow: Follow,
  trader: Trader,
  fetchedAt: string,
): ResolvedFollow {
  return {
    ...follow,
    // Prefer the API's casing so logs match what FOMO shows.
    handle: trader.handle ?? follow.handle,
    ok: true,
    displayName: trader.displayName,
    verified: trader.verified,
    pnlUsd: trader.pnlUsd,
    pnl24h: trader.pnl?.['24h'],
    trades: trader.trades,
    followers: trader.followers,
    wallets: trader.wallets,
    avgHoldSeconds:
      trader.averageHoldTimeSeconds ?? trader.profile?.averageHoldTimeSeconds,
    verifiedAt: fetchedAt,
  };
}

/** Strip the `@`, trim, lowercase - the form used for alert matching. */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

export function loadFollows(file = FOLLOWS_FILE): Follow[] {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed as { follows?: unknown }).follows;
  if (!Array.isArray(rows))
    throw new Error(`${file} must be an array of follows`);
  const seen = new Set<string>();
  const follows: Follow[] = [];
  for (const row of rows) {
    const entry = typeof row === 'string' ? { handle: row } : (row as Follow);
    if (!entry?.handle) continue;
    const handle = entry.handle.trim().replace(/^@+/, '');
    const key = handle.toLowerCase();
    if (seen.has(key)) continue; // last write wins would hide a duplicate typo
    seen.add(key);
    follows.push({ ...entry, handle });
  }
  return follows;
}

/** The roster the bot and the watcher actually use: {@link FOLLOWING} from
 * config.ts, with `follows.json` layered on top.
 *
 * The hardcoded list owns *who*; the file owns *how* - weight, caps, chains,
 * mute. Keeping them apart means editing one account's size never risks
 * dropping another from the roster, and a handle only ever appears once.
 * Handles present only in the file are kept, so `follows add` still works. */
export function followRoster(file = FOLLOWS_FILE): Follow[] {
  const overrides = new Map(
    loadFollows(file).map((follow) => [normalizeHandle(follow.handle), follow]),
  );
  const roster: Follow[] = [];
  const seen = new Set<string>();
  for (const handle of FOLLOWING) {
    const key = normalizeHandle(handle);
    if (key === normalizeHandle(MY_HANDLE) || seen.has(key)) continue;
    seen.add(key);
    // The file's handle spelling is ignored: config.ts is the source of truth
    // for the roster, and the match is case-insensitive anyway.
    roster.push({ ...overrides.get(key), handle });
  }
  for (const [key, follow] of overrides) {
    if (!seen.has(key) && key !== normalizeHandle(MY_HANDLE))
      roster.push(follow);
  }
  return roster;
}

export function saveFollows(follows: Follow[], file = FOLLOWS_FILE): void {
  writeFileSync(file, `${JSON.stringify(follows, null, 2)}\n`);
}

/** Index a follow list by normalized handle, for O(1) alert matching. */
export function followIndex(follows: Follow[]): Map<string, Follow> {
  return new Map(
    follows.map((follow) => [normalizeHandle(follow.handle), follow]),
  );
}

export interface ResolveOptions {
  /** Parallel lookups. Low by design: we are pacing against 60 req/min. */
  concurrency?: number;
  /** Total wall-clock budget for the whole pass. Enrichment is a nicety - the
   * bot must not sit in 429 backoff instead of watching the stream. */
  deadlineMs?: number;
  /** Spend wallet resolutions on handles that are not cached yet. Off by
   * default: at 25 a month, a 24/7 bot that resolved on every boot would be
   * dry within a day. `follows verify` turns it on deliberately. */
  verify?: boolean;
  /** Shared ledger, so a resolution spent here is remembered everywhere. */
  budget?: Budget;
  /** Pre-loaded cache; pass one to avoid re-reading the file per call. */
  cache?: Map<string, CachedTrader>;
  /** Where the cache lives. Defaults to {@link TRADER_CACHE_FILE}. */
  cacheFile?: string;
  /** Retries per lookup. Default 0: the bot's boot must not sit in backoff
   * while the stream waits. Interactive commands pass 2, because the API's
   * auth backend flaps and a one-shot check should ride it out. */
  maxRetries?: number;
  /** How long a free `/trades` check stays good. Default 12h: long enough that
   * a bot restarting all day costs nothing, short enough to notice a trader
   * going quiet. `0` forces a re-check. */
  activityTtlMs?: number;
}

/** Enrich every handle, cheaply by default.
 *
 * A cached trader is used as-is (already paid for). Everything else is checked
 * against `/v2/users/{handle}/trades`, which is served from captured data and
 * costs no wallet resolution. Only `verify: true` spends one of the 25.
 *
 * Anything unresolved comes back copyable with a `warning` - never dropped,
 * because a handle we could not enrich still fires alerts we want to copy. */
export async function resolveFollows(
  fomo: FomoClient,
  follows: Follow[],
  options: ResolveOptions = {},
): Promise<ResolvedFollow[]> {
  const {
    concurrency = 2,
    deadlineMs = 10_000,
    verify = false,
    activityTtlMs = 12 * 3_600_000,
    maxRetries = 0,
  } = options;
  const cacheFile = options.cacheFile ?? TRADER_CACHE_FILE;
  const cache = options.cache ?? loadTraderCache(cacheFile);
  let cacheDirty = false;
  // Unresolved rows keep their place in the list, so the table matches the file.
  const resolved: ResolvedFollow[] = follows.map((follow) => ({
    ...follow,
    ok: true,
    warning: 'lookup timed out',
  }));

  const controller = new AbortController();
  let expire: (() => void) | undefined;
  // The deadline both aborts in-flight requests and resolves the pass on its
  // own, so a request that ignores the abort - or an API that simply never
  // answers - still cannot hold up the stream.
  const expired = new Promise<void>((resolve) => {
    expire = resolve;
  });
  const deadline = setTimeout(() => {
    controller.abort();
    expire?.();
  }, deadlineMs);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < follows.length && !controller.signal.aborted) {
      const index = next++;
      const follow = follows[index] as Follow;
      const result = await resolveOne(fomo, follow, {
        cache,
        verify,
        activityTtlMs,
        maxRetries,
        ...(options.budget ? { budget: options.budget } : {}),
        ...(controller.signal ? { signal: controller.signal } : {}),
      });
      if (result.cached) cacheDirty = true;
      resolved[index] = result.follow;
    }
  };

  try {
    await Promise.race([
      Promise.all(
        Array.from({ length: Math.min(concurrency, follows.length) }, worker),
      ),
      expired,
    ]);
  } finally {
    clearTimeout(deadline);
    expire?.();
    if (cacheDirty) saveTraderCache(cache, cacheFile);
  }
  return resolved;
}

interface ResolveOneOptions {
  cache: Map<string, CachedTrader>;
  verify: boolean;
  activityTtlMs: number;
  maxRetries: number;
  budget?: Budget;
  signal?: AbortSignal;
}

async function resolveOne(
  fomo: FomoClient,
  follow: Follow,
  options: ResolveOneOptions,
): Promise<{ follow: ResolvedFollow; cached: boolean }> {
  const { cache, verify, activityTtlMs, maxRetries, budget, signal } = options;
  const key = normalizeHandle(follow.handle);
  const hit = cache.get(key);

  const merge = (extra: ResolvedFollow): ResolvedFollow =>
    hit?.trader && hit.fetchedAt
      ? { ...fromTrader(follow, hit.trader, hit.fetchedAt), ...extra }
      : extra;

  // 1. Everything already on disk is fresh enough: spend nothing at all. This
  //    is the steady state for a bot that restarts, and the reason a restart
  //    loop cannot eat the monthly quota.
  const fresh =
    hit?.activity !== undefined &&
    Date.now() - Date.parse(hit.activity.checkedAt) < activityTtlMs;
  if (!verify && fresh && hit?.activity) {
    return { follow: merge(fromActivity(follow, hit.activity)), cached: false };
  }
  if (
    !verify &&
    !fresh &&
    hit?.trader &&
    hit.fetchedAt &&
    activityTtlMs === Infinity
  ) {
    return {
      follow: fromTrader(follow, hit.trader, hit.fetchedAt),
      cached: false,
    };
  }

  // 2. Spend a wallet resolution only when asked, and only if one is left.
  //    A handle already resolved this month is free to re-resolve.
  if (
    verify &&
    (!budget || budget.walletsRemaining > 0 || budget.resolved(key))
  ) {
    try {
      const trader: Trader = await fomo.trader(follow.handle, {
        maxRetries,
        ...(signal ? { signal } : {}),
      });
      const fetchedAt = new Date().toISOString();
      cache.set(key, { ...cache.get(key), fetchedAt, trader });
      return { follow: fromTrader(follow, trader, fetchedAt), cached: true };
    } catch (error) {
      if (error instanceof FomoNotFoundError) {
        return {
          follow: { ...follow, ok: false, reason: 'no such handle on FOMO' },
          cached: false,
        };
      }
      // Out of resolutions after all: fall through to the free check rather
      // than reporting the trader as broken.
      if (
        !(error instanceof FomoRateLimitError) &&
        !(error instanceof BudgetError)
      ) {
        const detail = error instanceof Error ? error.message : String(error);
        return {
          follow: { ...follow, ok: true, warning: `unresolved: ${detail}` },
          cached: false,
        };
      }
    }
  }

  // 3. The free path: captured trade history. `available: true` proves the
  //    handle is real and active; `false` is inconclusive (a real trader with
  //    nothing captured looks identical to a typo), so we keep copying and say so.
  try {
    const { available, activeCount, closedCount } = await fomo.trades(
      follow.handle,
      {
        limit: 1,
        maxRetries,
        ...(signal ? { signal } : {}),
      },
    );
    const activity: CachedActivity = {
      checkedAt: new Date().toISOString(),
      available,
      ...(activeCount === undefined ? {} : { activeCount }),
      ...(closedCount === undefined ? {} : { closedCount }),
    };
    cache.set(key, { ...cache.get(key), activity });
    // Cached wallets plus a fresh activity count: the best of both.
    return { follow: merge(fromActivity(follow, activity)), cached: true };
  } catch (error) {
    if (error instanceof FomoNotFoundError) {
      return {
        follow: { ...follow, ok: false, reason: 'no such handle on FOMO' },
        cached: false,
      };
    }
    if (signal?.aborted)
      return {
        follow: { ...follow, ok: true, warning: 'lookup timed out' },
        cached: false,
      };
    if (hit?.activity) {
      // A stale cache beats no data, and beats blocking the stream on a retry.
      return {
        follow: merge(fromActivity(follow, hit.activity)),
        cached: false,
      };
    }
    if (error instanceof BudgetError) {
      return {
        follow: {
          ...follow,
          ok: true,
          warning: 'budget spent - not looked up',
        },
        cached: false,
      };
    }
    if (error instanceof FomoRateLimitError) {
      return {
        follow: { ...follow, ok: true, warning: 'lookup throttled' },
        cached: false,
      };
    }
    // The API's auth backend flaps; say so plainly rather than implying the
    // handle is at fault.
    const detail =
      error instanceof Error
        ? error.message.replace(/^\w+ \d+ .*?: /, '')
        : String(error);
    return {
      follow: { ...follow, ok: true, warning: `lookup failed: ${detail}` },
      cached: false,
    };
  }
}

/** Words that show up next to handles when you copy a following list out of
 * the FOMO app, and are never handles themselves. */
const NOISE = new Set([
  'followers',
  'following',
  'follow',
  'followed',
  'verified',
  'trader',
  'traders',
  'pnl',
  'usd',
  'vol',
  'volume',
  'trades',
  'holdings',
  'rank',
  'you',
  'and',
  'fomo',
]);

/** Pull handles out of whatever you paste - one per line, comma-separated, or a
 * screenful copied straight from the app with follower counts interleaved.
 *
 * `@`-prefixed tokens win when the text has any, since that is unambiguous;
 * otherwise each line contributes its first word. */
export function parseHandles(input: string): string[] {
  const tagged = [...input.matchAll(/@([A-Za-z0-9_]{2,32})\b/g)].map(
    (match) => match[1] as string,
  );
  const candidates =
    tagged.length > 0
      ? tagged
      : input
          .split(/[\n,;]+/)
          .map((line) => line.trim().split(/[\s|]+/)[0] ?? '')
          .filter(Boolean);

  const seen = new Set<string>();
  const handles: string[] = [];
  for (const candidate of candidates) {
    const handle = candidate.replace(/^@+/, '').trim();
    const key = handle.toLowerCase();
    // Drop the noise a paste drags along: counts, money, and column headers.
    if (
      handle.length < 2 ||
      NOISE.has(key) ||
      /^[\d.,$%+-]+[kmb]?$/i.test(handle)
    )
      continue;
    if (!/^[A-Za-z0-9_]+$/.test(handle) || seen.has(key)) continue;
    seen.add(key);
    handles.push(handle);
  }
  return handles;
}

const usd = (value: number | undefined): string =>
  value === undefined || value === null
    ? '-'
    : `$${Math.round(value).toLocaleString('en-US')}`;

/** Render the resolved list as a fixed-width table for the boot log.
 *
 * `open`/`closed` come from the free endpoint and are the activity signal we
 * can afford every boot; `pnl` only appears for traders whose wallets we have
 * paid to resolve at some point. */
export function formatFollows(rows: ResolvedFollow[]): string {
  const lines = [
    `  ${'handle'.padEnd(18)} ${'w'.padStart(4)}  ${'open'.padStart(5)} ${'closed'.padStart(6)}  ` +
      `${'pnl(all)'.padStart(12)}  hold    status`,
  ];
  for (const row of rows) {
    const hold = row.avgHoldSeconds
      ? `${Math.round(row.avgHoldSeconds / 60)}m`
      : '-';
    const status = !row.ok
      ? `DROP ${row.reason}`
      : row.mute
        ? 'muted'
        : row.warning
          ? `copying (${row.warning})`
          : row.verifiedAt
            ? `copying (wallets cached${row.verified ? ', verified pnl' : ''})`
            : 'copying';
    lines.push(
      `  @${row.handle.padEnd(17)} ${String(row.weight ?? 1).padStart(4)}  ` +
        `${String(row.activeCount ?? '-').padStart(5)} ${String(row.closedCount ?? '-').padStart(6)}  ` +
        `${usd(row.pnlUsd).padStart(12)}  ${hold.padEnd(6)}  ${status}`,
    );
  }
  return lines.join('\n');
}

const toChainId = chainId;

/**
 * The signal engine: FOMO alerts in, copy-trade decisions out.
 *
 * This is the FOMO half of the bot. It never touches a chain - it turns the
 * activity firehose into `CopySignal`s that an executor can act on, and records
 * exactly why every other alert was dropped. Keeping the decision layer pure
 * means the risk rules are testable without an RPC, a wallet, or real money.
 *
 *   alert -> gates -> sizing -> CopySignal -> (executor, later)
 */

export interface CopySignal {
  /** Alert id this came from - the executor's idempotency key. */
  id: string;
  eventId?: string;
  side: 'buy' | 'sell';
  /** Handle as FOMO spells it. */
  trader: string;
  /** The follow row that matched, for the executor's own rules. */
  follow: Follow;
  token: string;
  tokenAddress: string;
  chain: string;
  chainId: number;
  /** When the trader traded (unix millis). */
  ts: number;
  /** How stale the signal was when we decided. The delayed feed makes this
   * 60s+, which is the difference between copy trading and paying the exit. */
  ageMs: number;
  /** Their size, when the alert reports it. */
  traderUsd?: number;
  /** What we would spend, after weights and caps. A sell is a full exit of the
   * position this bot opened, so `usd` is what we put in. */
  usd: number;
  /** Human-readable sizing rationale, e.g. `"base 50 x weight 2"`. */
  sizing: string;
  source: string;
  text?: string;
}

/** Why an alert did not become a signal. Every alert produces a signal or one
 * of these - there is no silent drop. */
export type SkipReason =
  | 'replay'
  | 'not-a-trade'
  | 'not-followed'
  | 'muted'
  | 'no-token-address'
  | 'chain-not-allowed'
  | 'stale'
  | 'duplicate'
  | 'cooldown'
  | 'no-position'
  | 'daily-cap'
  | 'size-too-small';

export interface Skip {
  reason: SkipReason;
  alert: Alert;
  /** Extra context, e.g. `"aged 92s > 45s"`. */
  detail?: string;
}

export interface EngineConfig {
  /** Base position size in USD before a follow's weight. */
  baseUsd: number;
  /** Ceiling per signal, after weighting. */
  maxUsd: number;
  /** Floor - below this, fees make the copy pointless. */
  minUsd: number;
  /** Total USD of entries per UTC day. */
  dailyUsdCap: number;
  /** Chains we can actually execute on. An alert on anything else is dropped. */
  chains: string[];
  /** Refuse signals older than this. The 60s-delayed feed will trip it. */
  maxAgeMs: number;
  /** Ignore repeat entries on the same trader+token inside this window. */
  cooldownMs: number;
  /** Copy `push` alerts too. They duplicate the feed, so off by default. */
  includePush: boolean;
  /** Cap on remembered alert ids - dedupe memory, not a position ledger. */
  seenLimit: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  baseUsd: 50,
  maxUsd: 250,
  minUsd: 10,
  dailyUsdCap: 1000,
  chains: ['robinhood', 'solana', 'base', 'bsc', 'ethereum'],
  maxAgeMs: 45_000,
  cooldownMs: 5 * 60_000,
  includePush: false,
  seenLimit: 5_000,
};

/** An entry this bot decided to open, held until the trader exits. */
export interface Position {
  token: string;
  tokenAddress: string;
  chain: string;
  trader: string;
  usd: number;
  openedAt: number;
  signals: number;
}

export interface EngineEvents {
  signal: (signal: CopySignal) => void;
  skip: (skip: Skip) => void;
}

export class SignalEngine {
  readonly config: EngineConfig;

  private follows: Map<string, Follow>;
  private readonly seen = new Set<string>();
  private readonly cooldowns = new Map<string, number>();
  /** Keyed `chain:tokenAddress` - what we are holding from a copy. */
  private readonly positions = new Map<string, Position>();
  private readonly listeners: {
    [K in keyof EngineEvents]: Set<EngineEvents[K]>;
  } = {
    signal: new Set(),
    skip: new Set(),
  };

  private day = utcDay(Date.now());
  private spentToday = 0;

  constructor(follows: Follow[], config: Partial<EngineConfig> = {}) {
    this.follows = followIndex(follows);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Swap in a new follow list without restarting the bot. */
  setFollows(follows: Follow[]): void {
    this.follows = followIndex(follows);
  }

  get openPositions(): Position[] {
    return [...this.positions.values()];
  }

  /** USD of entries opened so far today, and what is left of the cap. */
  get budget(): { spent: number; remaining: number } {
    return this.budgetAt(Date.now());
  }

  /** The budget as of a given moment, rolling the day over if it has passed.
   * Takes an explicit clock so a backtest is not at the mercy of the wall one. */
  budgetAt(now: number): { spent: number; remaining: number } {
    this.rollDay(now);
    return {
      spent: this.spentToday,
      remaining: Math.max(0, this.config.dailyUsdCap - this.spentToday),
    };
  }

  /** Run one alert through every gate. Returns the signal, or null after
   * emitting a `skip` explaining itself. */
  handle(alert: Alert, now = Date.now()): CopySignal | null {
    this.rollDay(now);

    const skip = (reason: SkipReason, detail?: string): null => {
      this.emit('skip', { reason, alert, ...(detail ? { detail } : {}) });
      return null;
    };

    // 1. The backlog the socket replays on connect is history, not opportunity.
    if (alert.replay) return skip('replay');

    // 2. Only entries and exits are actionable; a thesis is context.
    // `alertKind` widens to string for forward compatibility; narrow it here so
    // the rest of the gate chain works on a real union.
    const kind = alertKind(alert);
    const side: 'buy' | 'sell' | null =
      kind === 'buy' ? 'buy' : kind === 'sell' ? 'sell' : null;
    if (!side) return skip('not-a-trade', kind ?? 'unknown');
    if (!this.config.includePush && alert.source === 'push')
      return skip('not-a-trade', 'push duplicate');

    // 3. Is this someone we follow?
    const handle = alert.trader ? normalizeHandle(alert.trader) : '';
    const follow = this.follows.get(handle);
    if (!follow) return skip('not-followed', alert.trader ?? 'unknown');
    if (follow.mute) return skip('muted', follow.handle);

    // 4. An executor needs a contract address and a chain, not a ticker.
    const tokenAddress = alert.tokenAddress?.trim();
    if (!tokenAddress) return skip('no-token-address', alert.token ?? '?');
    // Alerts carry the id, the name, or both. Resolve to the canonical pair so
    // the allowlist can be written either way.
    const chainId =
      alert.chainId ?? (alert.chain ? toChainId(alert.chain) : undefined);
    const chain =
      (chainId ? chainName(chainId) : undefined) ??
      (alert.chain ? normalizeChain(alert.chain) : undefined);
    if (!chain || !chainId)
      return skip(
        'chain-not-allowed',
        alert.chain ?? String(alert.chainId ?? 'unknown'),
      );

    const allowed = follow.chains ?? this.config.chains;
    if (!allowed.some((name) => normalizeChain(name) === chain))
      return skip('chain-not-allowed', chain);

    // 5. Late is worse than never: on a delayed feed the move is already made.
    const ageMs = Math.max(0, now - alert.ts);
    if (ageMs > this.config.maxAgeMs) {
      return skip(
        'stale',
        `aged ${Math.round(ageMs / 1000)}s > ${Math.round(this.config.maxAgeMs / 1000)}s`,
      );
    }

    // 6. The same trade reaches us as both a feed row and a push.
    const fingerprint =
      alert.eventId ?? `${handle}|${side}|${tokenAddress}|${alert.ts}`;
    if (this.seen.has(fingerprint) || this.seen.has(alert.id))
      return skip('duplicate', fingerprint);

    const key = `${normalizeChain(chain)}:${tokenAddress.toLowerCase()}`;
    const position = this.positions.get(key);

    const signal: CopySignal = {
      id: alert.id,
      ...(alert.eventId ? { eventId: alert.eventId } : {}),
      side,
      trader: alert.trader ?? follow.handle,
      follow,
      token: alert.token ?? tokenAddress.slice(0, 8),
      tokenAddress,
      chain,
      chainId,
      ts: alert.ts,
      ageMs,
      ...(alert.usdValue === null || alert.usdValue === undefined
        ? {}
        : { traderUsd: alert.usdValue }),
      usd: 0,
      sizing: '',
      source: alert.source ?? 'feed',
      ...(alert.text ? { text: alert.text } : {}),
    };

    if (side === 'sell') {
      // Only mirror an exit we have an entry for - otherwise we would be
      // shorting a token we never bought.
      if (!position) return skip('no-position', signal.token);
      this.remember(fingerprint, alert.id);
      this.positions.delete(key);
      return this.deliver({
        ...signal,
        usd: position.usd,
        sizing: `exit full position (${position.signals} entry/entries)`,
      });
    }

    // 7. Do not chase a trader who is scaling into the same token all morning.
    const cooldownKey = `${handle}|${key}`;
    const until = this.cooldowns.get(cooldownKey) ?? 0;
    if (now < until)
      return skip(
        'cooldown',
        `${Math.round((until - now) / 1000)}s left on ${signal.token}`,
      );

    // 8. Size it.
    const weight = follow.weight ?? 1;
    const wanted = this.config.baseUsd * weight;
    const ceiling = Math.min(this.config.maxUsd, follow.maxUsd ?? Infinity);
    const { remaining } = this.budgetAt(now);
    const usd = Math.min(wanted, ceiling, remaining);

    if (remaining <= 0)
      return skip('daily-cap', `$${this.config.dailyUsdCap} spent`);
    if (usd < this.config.minUsd) {
      return skip(
        'size-too-small',
        `$${usd.toFixed(2)} < $${this.config.minUsd}`,
      );
    }

    const capped =
      usd < wanted
        ? ` capped to $${usd} (${usd === remaining ? 'daily budget' : 'max'})`
        : '';
    this.remember(fingerprint, alert.id);
    this.cooldowns.set(cooldownKey, now + this.config.cooldownMs);
    this.spentToday += usd;
    this.positions.set(key, {
      token: signal.token,
      tokenAddress,
      chain,
      trader: signal.trader,
      usd: (position?.usd ?? 0) + usd,
      openedAt: position?.openedAt ?? now,
      signals: (position?.signals ?? 0) + 1,
    });

    return this.deliver({
      ...signal,
      usd,
      sizing: `base $${this.config.baseUsd} x ${weight}${capped}`,
    });
  }

  on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    this.listeners[event].add(listener);
    return this;
  }

  off<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    this.listeners[event].delete(listener);
    return this;
  }

  private deliver(signal: CopySignal): CopySignal {
    this.emit('signal', signal);
    return signal;
  }

  private remember(...keys: string[]): void {
    for (const key of keys) this.seen.add(key);
    // A Set iterates in insertion order, so the first entries are the oldest.
    while (this.seen.size > this.config.seenLimit) {
      const oldest = this.seen.values().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
  }

  private rollDay(now = Date.now()): void {
    const today = utcDay(now);
    if (today === this.day) return;
    this.day = today;
    this.spentToday = 0;
  }

  private emit<K extends keyof EngineEvents>(
    event: K,
    ...args: Parameters<EngineEvents[K]>
  ): void {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: Parameters<EngineEvents[K]>) => void)(...args);
      } catch {
        // A broken log line must not kill the bot mid-signal.
      }
    }
  }
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
