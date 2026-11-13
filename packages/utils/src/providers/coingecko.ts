export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | undefined | null;
type QueryParams = Record<string, QueryValue>;

type FetchHeadersLike = {
  get(name: string): string | null;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: FetchHeadersLike;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

export class CoinGeckoWrapperError extends Error {
  error_code: string | null;
  details: Record<string, unknown>;

  constructor(
    message: string,
    error_code: string | null = null,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CoinGeckoWrapperError";
    this.error_code = error_code;
    this.details = details;
  }

  to_dict(): Record<string, unknown> {
    return {
      error_type: this.name,
      message: this.message,
      error_code: this.error_code,
      details: this.details,
    };
  }
}

export class ConfigurationError extends CoinGeckoWrapperError {
  constructor(message: string, config_key?: string) {
    super(message, "CONFIGURATION_ERROR", config_key ? { config_key } : {});
    this.name = "ConfigurationError";
  }
}

export class AuthenticationError extends CoinGeckoWrapperError {
  constructor(message = "API authentication failed") {
    super(message, "AUTHENTICATION_ERROR", {
      suggestion:
        "Check your COINGECKO_PRO_API_KEY, COINGECKO_API_KEY, or CG_API_KEY environment variable",
    });
    this.name = "AuthenticationError";
  }
}

export class RateLimitExceededError extends CoinGeckoWrapperError {
  retry_after: number | null;
  limit: number | null;
  remaining: number | null;

  constructor(
    message = "API rate limit exceeded",
    retry_after: number | null = null,
    limit: number | null = null,
    remaining: number | null = null,
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", {
      ...(retry_after !== null ? { retry_after } : {}),
      ...(limit !== null ? { limit } : {}),
      ...(remaining !== null ? { remaining } : {}),
    });
    this.name = "RateLimitExceededError";
    this.retry_after = retry_after;
    this.limit = limit;
    this.remaining = remaining;
  }
}

export class APIConnectionError extends CoinGeckoWrapperError {
  constructor(
    message = "Failed to connect to CoinGecko API",
    endpoint?: string,
    status_code?: number,
  ) {
    super(message, "API_CONNECTION_ERROR", {
      ...(endpoint ? { endpoint } : {}),
      ...(status_code !== undefined ? { status_code } : {}),
    });
    this.name = "APIConnectionError";
  }
}

export class APIResponseError extends CoinGeckoWrapperError {
  status_code: number;
  response_body: unknown;

  constructor(
    message: string,
    status_code: number,
    response_body?: unknown,
    endpoint?: string,
  ) {
    super(message, `API_ERROR_${status_code}`, {
      status_code,
      ...(endpoint ? { endpoint } : {}),
      ...(response_body !== undefined ? { response_body } : {}),
    });
    this.name = "APIResponseError";
    this.status_code = status_code;
    this.response_body = response_body;
  }
}

export class ValidationError extends CoinGeckoWrapperError {
  constructor(
    message: string,
    field?: string,
    value?: unknown,
    expected_type?: string,
  ) {
    super(message, "VALIDATION_ERROR", {
      ...(field ? { field } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(expected_type ? { expected_type } : {}),
    });
    this.name = "ValidationError";
  }
}

export class CacheError extends CoinGeckoWrapperError {
  constructor(message: string, operation?: string) {
    super(message, "CACHE_ERROR", operation ? { operation } : {});
    this.name = "CacheError";
  }
}

export class DataNotFoundError extends CoinGeckoWrapperError {
  constructor(message = "Requested data not found", coin_id?: string, endpoint?: string) {
    super(message, "DATA_NOT_FOUND", {
      ...(coin_id ? { coin_id } : {}),
      ...(endpoint ? { endpoint } : {}),
    });
    this.name = "DataNotFoundError";
  }
}

export class TimeoutError extends CoinGeckoWrapperError {
  constructor(message = "API request timed out", timeout?: number, endpoint?: string) {
    super(message, "TIMEOUT_ERROR", {
      ...(timeout !== undefined ? { timeout } : {}),
      ...(endpoint ? { endpoint } : {}),
    });
    this.name = "TimeoutError";
  }
}

export class RetryExhaustedError extends CoinGeckoWrapperError {
  constructor(
    message = "All retry attempts exhausted",
    max_retries?: number,
    last_error?: unknown,
  ) {
    super(message, "RETRY_EXHAUSTED", {
      ...(max_retries !== undefined ? { max_retries } : {}),
      ...(last_error !== undefined ? { last_error: String(last_error) } : {}),
    });
    this.name = "RetryExhaustedError";
  }
}

export function create_exception_from_status(
  status_code: number,
  message: string,
  details: {
    endpoint?: string;
    response_body?: unknown;
    retry_after?: number | null;
  } = {},
): CoinGeckoWrapperError {
  if (status_code === 400) {
    return new ValidationError(message);
  }
  if (status_code === 401 || status_code === 403) {
    return new AuthenticationError(message);
  }
  if (status_code === 404) {
    return new DataNotFoundError(message, undefined, details.endpoint);
  }
  if (status_code === 429) {
    return new RateLimitExceededError(
      message,
      details.retry_after ?? null,
      null,
      null,
    );
  }
  if (status_code === 502 || status_code === 503) {
    return new APIConnectionError(message, details.endpoint, status_code);
  }
  if (status_code === 504) {
    return new TimeoutError(message, undefined, details.endpoint);
  }
  return new APIResponseError(
    message,
    status_code,
    details.response_body,
    details.endpoint,
  );
}

export function wrap_sdk_exception(
  sdk_exception: unknown,
  context?: string,
): CoinGeckoWrapperError {
  const baseMessage = sdk_exception instanceof Error ? sdk_exception.message : String(sdk_exception);
  const message = context ? `${context}: ${baseMessage}` : baseMessage;

  if (sdk_exception instanceof CoinGeckoWrapperError) {
    return sdk_exception;
  }

  if (sdk_exception instanceof DOMException && sdk_exception.name === "AbortError") {
    return new TimeoutError(message);
  }

  if (sdk_exception instanceof Error) {
    if (sdk_exception.name.toLowerCase().includes("timeout")) {
      return new TimeoutError(message);
    }
    return new APIConnectionError(message);
  }

  return new CoinGeckoWrapperError(message, "SDK_ERROR", {
    original_exception: typeof sdk_exception,
  });
}

export type CoinGeckoEnvironment = "pro" | "demo";

export class CoinGeckoConfig {
  api_key: string | null;
  environment: CoinGeckoEnvironment;
  base_url: string | null;
  calls_per_minute: number;
  rate_limit_buffer: number;
  max_retries: number;
  timeout: number;
  backoff_factor: number;
  cache_enabled: boolean;
  cache_ttl: number;
  cache_maxsize: number;
  log_level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  log_requests: boolean;
  log_cache_hits: boolean;

  constructor(values: Partial<CoinGeckoConfig> = {}) {
    this.api_key = values.api_key ?? null;
    this.environment = values.environment ?? "pro";
    this.base_url = values.base_url ?? null;
    this.calls_per_minute = values.calls_per_minute ?? 500;
    this.rate_limit_buffer = values.rate_limit_buffer ?? 0.9;
    this.max_retries = values.max_retries ?? 3;
    this.timeout = values.timeout ?? 30;
    this.backoff_factor = values.backoff_factor ?? 1;
    this.cache_enabled = values.cache_enabled ?? true;
    this.cache_ttl = values.cache_ttl ?? 300;
    this.cache_maxsize = values.cache_maxsize ?? 1000;
    this.log_level = values.log_level ?? "INFO";
    this.log_requests = values.log_requests ?? false;
    this.log_cache_hits = values.log_cache_hits ?? false;
  }

  static from_env(): CoinGeckoConfig {
    const cfg = new CoinGeckoConfig();

    cfg.api_key =
      process.env.COINGECKO_PRO_API_KEY ??
      process.env.COINGECKO_API_KEY ??
      process.env.CG_API_KEY ??
      null;

    const envValue = (process.env.COINGECKO_ENV ?? cfg.environment).toLowerCase();
    cfg.environment = envValue === "demo" ? "demo" : "pro";

    cfg.base_url = process.env.COINGECKO_BASE_URL ?? cfg.base_url;

    if (process.env.COINGECKO_CALLS_PER_MINUTE) {
      cfg.calls_per_minute = Number.parseInt(process.env.COINGECKO_CALLS_PER_MINUTE, 10);
    }
    if (process.env.COINGECKO_RATE_LIMIT_BUFFER) {
      cfg.rate_limit_buffer = Number.parseFloat(process.env.COINGECKO_RATE_LIMIT_BUFFER);
    }
    if (process.env.COINGECKO_MAX_RETRIES) {
      cfg.max_retries = Number.parseInt(process.env.COINGECKO_MAX_RETRIES, 10);
    }
    if (process.env.COINGECKO_TIMEOUT) {
      cfg.timeout = Number.parseFloat(process.env.COINGECKO_TIMEOUT);
    }
    if (process.env.COINGECKO_BACKOFF_FACTOR) {
      cfg.backoff_factor = Number.parseFloat(process.env.COINGECKO_BACKOFF_FACTOR);
    }
    if (process.env.COINGECKO_CACHE_ENABLED) {
      cfg.cache_enabled = ["true", "1", "yes", "on"].includes(
        process.env.COINGECKO_CACHE_ENABLED.toLowerCase(),
      );
    }
    if (process.env.COINGECKO_CACHE_TTL) {
      cfg.cache_ttl = Number.parseInt(process.env.COINGECKO_CACHE_TTL, 10);
    }
    if (process.env.COINGECKO_CACHE_MAXSIZE) {
      cfg.cache_maxsize = Number.parseInt(process.env.COINGECKO_CACHE_MAXSIZE, 10);
    }
    if (process.env.COINGECKO_LOG_LEVEL) {
      const lvl = process.env.COINGECKO_LOG_LEVEL.toUpperCase();
      if (["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].includes(lvl)) {
        cfg.log_level = lvl as CoinGeckoConfig["log_level"];
      }
    }
    if (process.env.COINGECKO_LOG_REQUESTS) {
      cfg.log_requests = ["true", "1", "yes", "on"].includes(
        process.env.COINGECKO_LOG_REQUESTS.toLowerCase(),
      );
    }
    if (process.env.COINGECKO_LOG_CACHE_HITS) {
      cfg.log_cache_hits = ["true", "1", "yes", "on"].includes(
        process.env.COINGECKO_LOG_CACHE_HITS.toLowerCase(),
      );
    }

    return cfg;
  }

  validate(): void {
    const errors: string[] = [];

    if (!this.api_key) {
      errors.push(
        "CoinGecko API key is required. Set COINGECKO_PRO_API_KEY, COINGECKO_API_KEY, or CG_API_KEY.",
      );
    }
    if (!["pro", "demo"].includes(this.environment)) {
      errors.push("environment must be 'pro' or 'demo'");
    }
    if (this.calls_per_minute <= 0) {
      errors.push("calls_per_minute must be positive");
    }
    if (!(this.rate_limit_buffer > 0 && this.rate_limit_buffer <= 1)) {
      errors.push("rate_limit_buffer must be between 0 and 1");
    }
    if (this.max_retries < 0) {
      errors.push("max_retries must be non-negative");
    }
    if (this.timeout <= 0) {
      errors.push("timeout must be positive");
    }
    if (this.backoff_factor < 0) {
      errors.push("backoff_factor must be non-negative");
    }
    if (this.cache_ttl < 0) {
      errors.push("cache_ttl must be non-negative");
    }
    if (this.cache_maxsize <= 0) {
      errors.push("cache_maxsize must be positive");
    }

    if (errors.length > 0) {
      throw new ConfigurationError(`Configuration validation failed:\n- ${errors.join("\n- ")}`);
    }
  }

  get_effective_rate_limit(): number {
    return Math.max(1, Math.floor(this.calls_per_minute * this.rate_limit_buffer));
  }

  to_dict(): Record<string, unknown> {
    return {
      environment: this.environment,
      calls_per_minute: this.calls_per_minute,
      effective_calls_per_minute: this.get_effective_rate_limit(),
      rate_limit_buffer: this.rate_limit_buffer,
      max_retries: this.max_retries,
      timeout: this.timeout,
      backoff_factor: this.backoff_factor,
      cache_enabled: this.cache_enabled,
      cache_ttl: this.cache_ttl,
      cache_maxsize: this.cache_maxsize,
      log_level: this.log_level,
      log_requests: this.log_requests,
      log_cache_hits: this.log_cache_hits,
      api_key_configured: Boolean(this.api_key),
      ...(this.base_url ? { base_url: this.base_url } : {}),
    };
  }
}

export function get_default_config(): CoinGeckoConfig {
  const config = CoinGeckoConfig.from_env();
  config.validate();
  return config;
}

export function setup_logging(_config: CoinGeckoConfig): void {
  // No-op placeholder for API parity with Python implementation.
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinComma(value: string | string[]): string {
  return Array.isArray(value) ? value.join(",") : value;
}

function toDdMmYyyy(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = value.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function parseRetryAfter(headers: FetchHeadersLike): number | null {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) {
    return null;
  }
  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  return null;
}

function cleanParams(params?: QueryParams): URLSearchParams {
  const search = new URLSearchParams();
  if (!params) {
    return search;
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  return search;
}

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

export type CoinGeckoAPIWrapperOptions = {
  config?: CoinGeckoConfig;
  api_key?: string;
  cache_ttl?: number;
  max_retries?: number;
  timeout?: number;
  base_url?: string;
  environment?: CoinGeckoEnvironment;
  cache_enabled?: boolean;
  cache_maxsize?: number;
  fetch?: FetchLike;
};

export class CoinGeckoAPIWrapper {
  readonly config: CoinGeckoConfig;
  readonly simple: SimpleEndpoints;
  readonly coins: CoinsEndpoints;
  readonly markets: MarketsEndpoints;
  readonly search: SearchEndpoints;
  readonly derivatives: DerivativesEndpoints;
  readonly global_data: GlobalDataEndpoints;
  readonly categories: CategoriesEndpoints;

  private readonly fetchImpl: FetchLike;
  private readonly cache: Map<string, CacheEntry>;
  private lastRequestAtMs: number;

  constructor(options: CoinGeckoAPIWrapperOptions = {}) {
    const baseConfig = options.config ?? get_default_config();
    this.config = new CoinGeckoConfig(baseConfig);

    if (options.api_key !== undefined) this.config.api_key = options.api_key;
    if (options.cache_ttl !== undefined) this.config.cache_ttl = options.cache_ttl;
    if (options.max_retries !== undefined) this.config.max_retries = options.max_retries;
    if (options.timeout !== undefined) this.config.timeout = options.timeout;
    if (options.base_url !== undefined) this.config.base_url = options.base_url;
    if (options.environment !== undefined) this.config.environment = options.environment;
    if (options.cache_enabled !== undefined) this.config.cache_enabled = options.cache_enabled;
    if (options.cache_maxsize !== undefined) this.config.cache_maxsize = options.cache_maxsize;

    this.config.validate();

    const nativeFetch = globalThis.fetch as unknown as FetchLike | undefined;
    this.fetchImpl =
      options.fetch ??
      nativeFetch ??
      (() => {
        throw new ConfigurationError("fetch is not available in this runtime");
      });

    this.cache = new Map<string, CacheEntry>();
    this.lastRequestAtMs = 0;

    this.simple = new SimpleEndpoints(this);
    this.coins = new CoinsEndpoints(this);
    this.markets = new MarketsEndpoints(this);
    this.search = new SearchEndpoints(this);
    this.derivatives = new DerivativesEndpoints(this);
    this.global_data = new GlobalDataEndpoints(this);
    this.categories = new CategoriesEndpoints(this);
  }

  private getHeaderName(): string {
    return this.config.environment === "pro" ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
  }

  private getBaseUrl(): string {
    if (this.config.base_url) {
      return this.config.base_url.replace(/\/+$/, "");
    }
    return this.config.environment === "pro"
      ? "https://pro-api.coingecko.com/api/v3"
      : "https://api.coingecko.com/api/v3";
  }

  private buildUrl(path: string, params?: QueryParams): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.getBaseUrl()}${normalizedPath}`);
    const query = cleanParams(params);
    if (query.size > 0) {
      url.search = query.toString();
    }
    return url.toString();
  }

  _get_cache_key(method: string, params?: QueryParams): string {
    if (!params) {
      return method;
    }
    const normalized = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join("&");
    return normalized ? `${method}?${normalized}` : method;
  }

  private getCached(key: string): unknown | undefined {
    if (!this.config.cache_enabled) {
      return undefined;
    }
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCached(key: string, value: unknown): void {
    if (!this.config.cache_enabled) {
      return;
    }
    if (this.cache.size >= this.config.cache_maxsize) {
      const first = this.cache.keys().next().value as string | undefined;
      if (first) {
        this.cache.delete(first);
      }
    }
    this.cache.set(key, {
      expiresAt: Date.now() + this.config.cache_ttl * 1000,
      value,
    });
  }

  private async rateLimitWait(): Promise<void> {
    const effectiveRate = this.config.get_effective_rate_limit();
    const minIntervalMs = 60_000 / effectiveRate;
    const now = Date.now();
    const elapsed = now - this.lastRequestAtMs;
    if (elapsed < minIntervalMs) {
      await delay(minIntervalMs - elapsed);
    }
  }

  private async parseResponse(response: FetchResponseLike): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    try {
      return await response.json();
    } catch {
      return response.text();
    }
  }

  async _make_request(method: string, path: string, params?: QueryParams): Promise<unknown> {
    const cacheKey = this._get_cache_key(method, params);
    const cached = this.getCached(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (this.config.api_key) {
      headers[this.getHeaderName()] = this.config.api_key;
    }

    let lastError: unknown;
    const retries = this.config.max_retries;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await this.rateLimitWait();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout * 1000);

      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        this.lastRequestAtMs = Date.now();

        if (!response.ok) {
          const responseBody = await this.parseResponse(response);
          const retryAfter = parseRetryAfter(response.headers);
          const error = create_exception_from_status(
            response.status,
            `CoinGecko API request failed (${response.status} ${response.statusText})`,
            {
              endpoint: url,
              response_body: responseBody,
              retry_after: retryAfter,
            },
          );

          const canRetry =
            attempt < retries && (response.status === 429 || response.status >= 500);

          if (canRetry) {
            const backoffMs = Math.max(
              250,
              Math.floor(this.config.backoff_factor * 1000 * 2 ** attempt),
            );
            const retryDelay = retryAfter !== null ? retryAfter * 1000 : backoffMs;
            await delay(retryDelay);
            lastError = error;
            continue;
          }

          throw error;
        }

        const payload = await this.parseResponse(response);
        this.setCached(cacheKey, payload);
        return payload;
      } catch (error) {
        const wrapped = wrap_sdk_exception(error, method);
        const canRetry =
          attempt < retries &&
          (wrapped instanceof TimeoutError || wrapped instanceof APIConnectionError);

        if (canRetry) {
          const backoffMs = Math.max(
            250,
            Math.floor(this.config.backoff_factor * 1000 * 2 ** attempt),
          );
          await delay(backoffMs);
          lastError = wrapped;
          continue;
        }

        throw wrapped;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new RetryExhaustedError("All retry attempts exhausted", retries, lastError);
  }

  async get_token_price(symbol: string, vs_currency = "usd"): Promise<number | null> {
    const coin_id = get_coingecko_id_from_symbol(symbol);
    if (!coin_id) {
      return null;
    }
    try {
      const result = (await this.simple.get_price([coin_id], [vs_currency])) as Record<
        string,
        Record<string, number>
      >;
      return result[coin_id]?.[vs_currency] ?? null;
    } catch {
      return null;
    }
  }

  async get_multiple_token_prices(
    symbols: readonly string[],
    vs_currency = "usd",
  ): Promise<Record<string, number | null>> {
    const idMap = get_multiple_coingecko_ids(symbols);
    const validIds = Object.values(idMap).filter((id): id is string => Boolean(id));
    if (validIds.length === 0) {
      return Object.fromEntries(symbols.map((symbol) => [symbol, null]));
    }

    try {
      const result = (await this.simple.get_price(validIds, [vs_currency])) as Record<
        string,
        Record<string, number>
      >;
      const out: Record<string, number | null> = {};
      for (const symbol of symbols) {
        const coinId = idMap[symbol];
        out[symbol] = coinId ? (result[coinId]?.[vs_currency] ?? null) : null;
      }
      return out;
    } catch {
      return Object.fromEntries(symbols.map((symbol) => [symbol, null]));
    }
  }

  async get_token_market_data(symbol: string): Promise<Record<string, unknown> | null> {
    const coin_id = get_coingecko_id_from_symbol(symbol);
    if (!coin_id) {
      return null;
    }
    try {
      return (await this.coins.get_by_id(coin_id)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  validate_symbols(symbols: string[]): Record<string, boolean> {
    return validate_token_symbols(symbols);
  }

  async get_eth_top_10_prices(vs_currency = "usd"): Promise<Record<string, number | null>> {
    return this.get_multiple_token_prices(ETH_TOP_10_TOKENS, vs_currency);
  }

  async get_sol_top_10_prices(vs_currency = "usd"): Promise<Record<string, number | null>> {
    return this.get_multiple_token_prices(SOL_TOP_10_TOKENS, vs_currency);
  }

  async test_connection(): Promise<boolean> {
    try {
      await this._make_request("ping", "/ping");
      return true;
    } catch {
      return false;
    }
  }

  clear_cache(): void {
    this.cache.clear();
  }

  get_cache_info(): Record<string, unknown> {
    return {
      size: this.cache.size,
      maxsize: this.config.cache_maxsize,
      ttl: this.config.cache_ttl,
    };
  }
}

export class AsyncCoinGeckoAPIWrapper extends CoinGeckoAPIWrapper {}

export class SimpleEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_price(
    ids: string | string[],
    vs_currencies: string | string[] = "usd",
    include_market_cap = false,
    include_24hr_vol = false,
    include_24hr_change = false,
    include_last_updated_at = false,
    precision?: number,
  ): Promise<unknown> {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) {
      throw new ValidationError("At least one coin ID must be provided", "ids", ids);
    }
    if (!vs_currencies || (Array.isArray(vs_currencies) && vs_currencies.length === 0)) {
      throw new ValidationError(
        "At least one vs_currency must be provided",
        "vs_currencies",
        vs_currencies,
      );
    }

    if (precision !== undefined && (!Number.isInteger(precision) || precision < 0)) {
      throw new ValidationError("precision must be a non-negative integer", "precision", precision);
    }

    return this.wrapper._make_request("simple_price", "/simple/price", {
      ids: joinComma(ids),
      vs_currencies: joinComma(vs_currencies),
      include_market_cap,
      include_24hr_vol,
      include_24hr_change,
      include_last_updated_at,
      ...(precision !== undefined ? { precision } : {}),
    });
  }

  async get_token_price(
    platform: string,
    contract_addresses: string | string[],
    vs_currencies: string | string[] = "usd",
    include_market_cap = false,
    include_24hr_vol = false,
    include_24hr_change = false,
    include_last_updated_at = false,
    precision?: number,
  ): Promise<unknown> {
    if (!platform) {
      throw new ValidationError("platform must be provided", "platform", platform);
    }
    if (!contract_addresses || (Array.isArray(contract_addresses) && contract_addresses.length === 0)) {
      throw new ValidationError(
        "At least one contract address must be provided",
        "contract_addresses",
        contract_addresses,
      );
    }

    return this.wrapper._make_request(
      `token_price_${platform}`,
      `/simple/token_price/${encodeURIComponent(platform)}`,
      {
        contract_addresses: joinComma(contract_addresses),
        vs_currencies: joinComma(vs_currencies),
        include_market_cap,
        include_24hr_vol,
        include_24hr_change,
        include_last_updated_at,
        ...(precision !== undefined ? { precision } : {}),
      },
    );
  }

  async get_supported_vs_currencies(): Promise<unknown> {
    return this.wrapper._make_request(
      "supported_vs_currencies",
      "/simple/supported_vs_currencies",
    );
  }

  async get_price_history_by_timestamp(
    coin_id: string,
    timestamp: number,
    _vs_currencies: string | string[] = "usd",
    localization = false,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }
    if (!Number.isInteger(timestamp) || timestamp <= 0) {
      throw new ValidationError("timestamp must be a positive integer", "timestamp", timestamp);
    }

    const date = toDdMmYyyy(new Date(timestamp * 1000));
    return this.wrapper._make_request(
      `price_history_${coin_id}_${timestamp}`,
      `/coins/${encodeURIComponent(coin_id)}/history`,
      {
        date,
        localization,
      },
    );
  }
}

export class CoinsEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_list(include_platform = false, status = "active"): Promise<unknown> {
    return this.wrapper._make_request("coins_list", "/coins/list", {
      include_platform,
      ...(status !== "active" ? { status } : {}),
    });
  }

  async get_markets(
    vs_currency = "usd",
    ids?: string | string[],
    category?: string,
    order = "market_cap_desc",
    per_page = 100,
    page = 1,
    sparkline = false,
    price_change_percentage?: string | string[],
    locale = "en",
    precision?: number,
  ): Promise<unknown> {
    if (per_page < 1 || per_page > 250) {
      throw new ValidationError("per_page must be between 1 and 250", "per_page", per_page);
    }
    if (page < 1) {
      throw new ValidationError("page must be positive", "page", page);
    }

    return this.wrapper._make_request("coins_markets", "/coins/markets", {
      vs_currency,
      order,
      per_page,
      page,
      sparkline,
      locale,
      ...(ids ? { ids: joinComma(ids) } : {}),
      ...(category ? { category } : {}),
      ...(price_change_percentage
        ? { price_change_percentage: joinComma(price_change_percentage) }
        : {}),
      ...(precision !== undefined ? { precision } : {}),
    });
  }

  async get_by_id(
    coin_id: string,
    localization = false,
    tickers = false,
    market_data = true,
    community_data = false,
    developer_data = false,
    sparkline = false,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }

    return this.wrapper._make_request(`coin_${coin_id}`, `/coins/${encodeURIComponent(coin_id)}`, {
      localization,
      tickers,
      market_data,
      community_data,
      developer_data,
      sparkline,
    });
  }

  async get_history(
    coin_id: string,
    date: string | Date,
    localization = false,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }

    const dateString = date instanceof Date ? toDdMmYyyy(date) : date;
    return this.wrapper._make_request(
      `coin_history_${coin_id}_${dateString}`,
      `/coins/${encodeURIComponent(coin_id)}/history`,
      { date: dateString, localization },
    );
  }

  async get_market_chart(
    coin_id: string,
    vs_currency = "usd",
    days: number | string = 30,
    interval?: string,
    precision?: number,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }

    return this.wrapper._make_request(
      `market_chart_${coin_id}_${vs_currency}_${String(days)}`,
      `/coins/${encodeURIComponent(coin_id)}/market_chart`,
      {
        vs_currency,
        days: String(days),
        ...(interval ? { interval } : {}),
        ...(precision !== undefined ? { precision } : {}),
      },
    );
  }

  async get_market_chart_range(
    coin_id: string,
    vs_currency: string,
    from_timestamp: number,
    to_timestamp: number,
    precision?: number,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }
    if (from_timestamp >= to_timestamp) {
      throw new ValidationError(
        "from_timestamp must be less than to_timestamp",
        "from_timestamp",
        from_timestamp,
      );
    }

    return this.wrapper._make_request(
      `market_chart_range_${coin_id}_${vs_currency}_${from_timestamp}_${to_timestamp}`,
      `/coins/${encodeURIComponent(coin_id)}/market_chart/range`,
      {
        vs_currency,
        from: from_timestamp,
        to: to_timestamp,
        ...(precision !== undefined ? { precision } : {}),
      },
    );
  }

  async get_ohlc(
    coin_id: string,
    vs_currency = "usd",
    days: number | string = 30,
    precision?: number,
  ): Promise<unknown> {
    if (!coin_id) {
      throw new ValidationError("coin_id must be provided", "coin_id", coin_id);
    }

    return this.wrapper._make_request(
      `ohlc_${coin_id}_${vs_currency}_${String(days)}`,
      `/coins/${encodeURIComponent(coin_id)}/ohlc`,
      {
        vs_currency,
        days: String(days),
        ...(precision !== undefined ? { precision } : {}),
      },
    );
  }
}

export class MarketsEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_trending(): Promise<unknown> {
    return this.wrapper._make_request("trending", "/search/trending");
  }

  async get_categories(order = "market_cap_desc"): Promise<unknown> {
    return this.wrapper._make_request(`categories_${order}`, "/coins/categories", { order });
  }

  async get_category_data(
    category_id: string,
    order = "market_cap_desc",
    per_page = 100,
    page = 1,
  ): Promise<unknown> {
    if (!category_id) {
      throw new ValidationError("category_id must be provided", "category_id", category_id);
    }
    if (per_page < 1 || per_page > 250) {
      throw new ValidationError("per_page must be between 1 and 250", "per_page", per_page);
    }

    return this.wrapper._make_request(`category_${category_id}`, "/coins/markets", {
      vs_currency: "usd",
      category: category_id,
      order,
      per_page,
      page,
      sparkline: false,
    });
  }

  async get_exchanges(per_page = 100, page = 1): Promise<unknown> {
    if (per_page < 1 || per_page > 250) {
      throw new ValidationError("per_page must be between 1 and 250", "per_page", per_page);
    }
    if (page < 1) {
      throw new ValidationError("page must be positive", "page", page);
    }
    return this.wrapper._make_request(`exchanges_${page}`, "/exchanges", {
      per_page,
      page,
    });
  }

  async get_exchange_by_id(exchange_id: string): Promise<unknown> {
    if (!exchange_id) {
      throw new ValidationError("exchange_id must be provided", "exchange_id", exchange_id);
    }
    return this.wrapper._make_request(
      `exchange_${exchange_id}`,
      `/exchanges/${encodeURIComponent(exchange_id)}`,
    );
  }

  async get_exchange_tickers(
    exchange_id: string,
    coin_ids?: string | string[],
    include_exchange_logo = false,
    page = 1,
    depth = false,
    order = "trust_score_desc",
  ): Promise<unknown> {
    if (!exchange_id) {
      throw new ValidationError("exchange_id must be provided", "exchange_id", exchange_id);
    }

    return this.wrapper._make_request(
      `exchange_tickers_${exchange_id}_${page}`,
      `/exchanges/${encodeURIComponent(exchange_id)}/tickers`,
      {
        include_exchange_logo,
        page,
        depth,
        order,
        ...(coin_ids ? { coin_ids: joinComma(coin_ids) } : {}),
      },
    );
  }

  async get_global_market_data(): Promise<unknown> {
    return this.wrapper._make_request("global", "/global");
  }

  async get_global_defi_data(): Promise<unknown> {
    return this.wrapper._make_request("global_defi", "/global/decentralized_finance_defi");
  }

  async get_nfts_list(
    order = "h24_volume_native_desc",
    asset_platform_id?: string,
    per_page = 100,
    page = 1,
  ): Promise<unknown> {
    return this.wrapper._make_request(`nfts_list_${page}`, "/nfts/list", {
      order,
      per_page,
      page,
      ...(asset_platform_id ? { asset_platform_id } : {}),
    });
  }

  async get_nft_by_id(nft_id: string): Promise<unknown> {
    if (!nft_id) {
      throw new ValidationError("nft_id must be provided", "nft_id", nft_id);
    }
    return this.wrapper._make_request(`nft_${nft_id}`, `/nfts/${encodeURIComponent(nft_id)}`);
  }
}

export class SearchEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async search(query: string): Promise<unknown> {
    if (!query || !query.trim()) {
      throw new ValidationError("Search query must be non-empty", "query", query);
    }

    const trimmed = query.trim();
    return this.wrapper._make_request(
      `search_${trimmed.toLowerCase().replace(/\s+/g, "_")}`,
      "/search",
      { query: trimmed },
    );
  }

  async search_coins(query: string, limit?: number): Promise<unknown[]> {
    const results = (await this.search(query)) as Record<string, unknown>;
    const coins = (results.coins ?? []) as unknown[];
    return limit && limit > 0 ? coins.slice(0, limit) : coins;
  }

  async search_exchanges(query: string, limit?: number): Promise<unknown[]> {
    const results = (await this.search(query)) as Record<string, unknown>;
    const exchanges = (results.exchanges ?? []) as unknown[];
    return limit && limit > 0 ? exchanges.slice(0, limit) : exchanges;
  }

  async search_categories(query: string, limit?: number): Promise<unknown[]> {
    const results = (await this.search(query)) as Record<string, unknown>;
    const categories = (results.categories ?? []) as unknown[];
    return limit && limit > 0 ? categories.slice(0, limit) : categories;
  }

  async search_nfts(query: string, limit?: number): Promise<unknown[]> {
    const results = (await this.search(query)) as Record<string, unknown>;
    const nfts = (results.nfts ?? []) as unknown[];
    return limit && limit > 0 ? nfts.slice(0, limit) : nfts;
  }

  async find_coin_by_symbol(
    symbol: string,
    exact_match = true,
  ): Promise<Record<string, unknown> | null> {
    if (!symbol) {
      throw new ValidationError("symbol must be provided", "symbol", symbol);
    }
    const target = symbol.toUpperCase().trim();
    const coins = (await this.search_coins(target)) as Record<string, unknown>[];
    if (coins.length === 0) {
      return null;
    }
    if (!exact_match) {
      return coins[0] ?? null;
    }
    for (const coin of coins) {
      if (String(coin.symbol ?? "").toUpperCase() === target) {
        return coin;
      }
    }
    return null;
  }

  async find_coin_by_name(
    name: string,
    exact_match = false,
  ): Promise<Record<string, unknown> | null> {
    if (!name) {
      throw new ValidationError("name must be provided", "name", name);
    }
    const target = name.trim();
    const coins = (await this.search_coins(target)) as Record<string, unknown>[];
    if (coins.length === 0) {
      return null;
    }
    if (!exact_match) {
      return coins[0] ?? null;
    }
    const lower = target.toLowerCase();
    for (const coin of coins) {
      if (String(coin.name ?? "").toLowerCase() === lower) {
        return coin;
      }
    }
    return null;
  }

  async get_trending(): Promise<unknown> {
    return this.wrapper._make_request("search_trending", "/search/trending");
  }

  async suggest_coins(query: string, limit = 5): Promise<string[]> {
    if (!query) {
      return [];
    }
    const coins = (await this.search_coins(query, limit * 2)) as Record<string, unknown>[];
    const out: string[] = [];
    for (const coin of coins) {
      const id = coin.id;
      if (typeof id !== "string") {
        continue;
      }
      if (!out.includes(id)) {
        out.push(id);
      }
      if (out.length >= limit) {
        break;
      }
    }
    return out;
  }
}

export class DerivativesEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_exchanges(order = "name_asc", per_page = 100, page = 1): Promise<unknown> {
    if (per_page < 1 || per_page > 250) {
      throw new ValidationError("per_page must be between 1 and 250", "per_page", per_page);
    }
    if (page < 1) {
      throw new ValidationError("page must be positive", "page", page);
    }

    return this.wrapper._make_request(`derivatives_exchanges_${page}`, "/derivatives/exchanges", {
      order,
      per_page,
      page,
    });
  }

  async get_exchange_by_id(exchange_id: string, include_tickers?: string): Promise<unknown> {
    if (!exchange_id) {
      throw new ValidationError("exchange_id must be provided", "exchange_id", exchange_id);
    }

    return this.wrapper._make_request(
      `derivatives_exchange_${exchange_id}`,
      `/derivatives/exchanges/${encodeURIComponent(exchange_id)}`,
      include_tickers ? { include_tickers } : undefined,
    );
  }

  async get_tickers(order?: string, include_expired = false): Promise<unknown> {
    return this.wrapper._make_request("derivatives_tickers", "/derivatives", {
      ...(order ? { order } : {}),
      include_expired,
    });
  }

  async get_perpetuals(order = "volume_desc", per_page = 100, page = 1): Promise<unknown> {
    return this.wrapper._make_request(`perpetuals_${page}`, "/derivatives", {
      order,
      per_page,
      page,
      contract_type: "perpetual",
    });
  }

  async get_futures(include_expired = false): Promise<unknown> {
    return this.wrapper._make_request("futures", "/derivatives", {
      include_expired,
      contract_type: "futures",
    });
  }

  async get_exchange_tickers(
    exchange_id: string,
    page = 1,
    expired: "true" | "false" | "all" = "false",
  ): Promise<unknown> {
    if (!exchange_id) {
      throw new ValidationError("exchange_id must be provided", "exchange_id", exchange_id);
    }

    return this.wrapper._make_request(
      `derivatives_exchange_tickers_${exchange_id}_${page}`,
      `/derivatives/exchanges/${encodeURIComponent(exchange_id)}`,
      {
        include_tickers: expired === "all" ? "all" : "unexpired",
        page,
        expired,
      },
    );
  }

  async get_market_index(market_id: string, days = 30): Promise<unknown> {
    if (!market_id) {
      throw new ValidationError("market_id must be provided", "market_id", market_id);
    }
    return this.wrapper._make_request(`derivatives_market_index_${market_id}_${days}`, "/derivatives", {
      market: market_id,
      days,
    });
  }
}

export class GlobalDataEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_global(): Promise<unknown> {
    return this.wrapper._make_request("global", "/global");
  }

  async get_global_defi(): Promise<unknown> {
    return this.wrapper._make_request("global_defi", "/global/decentralized_finance_defi");
  }

  async get_market_cap_chart(days = 30, vs_currency = "usd"): Promise<unknown> {
    return this.wrapper._make_request(
      `global_market_cap_chart_${days}_${vs_currency}`,
      "/global/market_cap_chart",
      { days, vs_currency },
    );
  }

  async get_companies_holdings(coin_id: "bitcoin" | "ethereum" = "bitcoin"): Promise<unknown> {
    return this.wrapper._make_request(
      `companies_${coin_id}`,
      `/companies/public_treasury/${encodeURIComponent(coin_id)}`,
    );
  }

  async get_trending_search(): Promise<unknown> {
    return this.wrapper._make_request("trending_search", "/search/trending");
  }

  async get_global_market_status(): Promise<unknown> {
    return this.get_global();
  }

  async get_btc_dominance(): Promise<number> {
    const globalData = (await this.get_global()) as Record<string, unknown>;
    const data = (globalData.data ?? {}) as Record<string, unknown>;
    const mcp = (data.market_cap_percentage ?? {}) as Record<string, unknown>;
    const value = mcp.btc;
    return typeof value === "number" ? value : 0;
  }

  async get_total_market_cap(vs_currency = "usd"): Promise<number> {
    const globalData = (await this.get_global()) as Record<string, unknown>;
    const data = (globalData.data ?? {}) as Record<string, unknown>;
    const mc = (data.total_market_cap ?? {}) as Record<string, unknown>;
    const value = mc[vs_currency];
    return typeof value === "number" ? value : 0;
  }

  async get_total_volume(vs_currency = "usd"): Promise<number> {
    const globalData = (await this.get_global()) as Record<string, unknown>;
    const data = (globalData.data ?? {}) as Record<string, unknown>;
    const tv = (data.total_volume ?? {}) as Record<string, unknown>;
    const value = tv[vs_currency];
    return typeof value === "number" ? value : 0;
  }
}

export class CategoriesEndpoints {
  private readonly wrapper: CoinGeckoAPIWrapper;

  constructor(wrapper: CoinGeckoAPIWrapper) {
    this.wrapper = wrapper;
  }

  async get_categories_list(): Promise<Array<{ category_id: string; name: string }>> {
    const response = (await this.wrapper._make_request(
      "categories_list",
      "/coins/categories/list",
    )) as Array<Record<string, unknown>>;

    return response.map((category) => ({
      category_id: String(category.category_id ?? ""),
      name: String(category.name ?? ""),
    }));
  }

  async get_categories_with_market_data(
    order = "market_cap_desc",
  ): Promise<Array<Record<string, unknown>>> {
    const response = (await this.wrapper._make_request(
      "categories_market_data",
      "/coins/categories",
      { order },
    )) as Array<Record<string, unknown>>;

    return response.map((category) => ({
      id: category.id,
      name: category.name,
      market_cap: category.market_cap,
      market_cap_change_24h: category.market_cap_change_24h,
      content: category.content,
      top_3_coins: category.top_3_coins,
      volume_24h: category.volume_24h,
      updated_at: category.updated_at,
    }));
  }

  async get_coins_by_category(
    category: string,
    vs_currency = "usd",
    order = "market_cap_desc",
    per_page = 100,
    page = 1,
    sparkline = false,
    price_change_percentage?: string,
    locale = "en",
    precision?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const response = (await this.wrapper._make_request(
      `coins_by_category_${category}`,
      "/coins/markets",
      {
        vs_currency,
        category,
        order,
        per_page,
        page,
        sparkline,
        locale,
        ...(price_change_percentage ? { price_change_percentage } : {}),
        ...(precision ? { precision } : {}),
      },
    )) as Array<Record<string, unknown>>;

    return response.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      current_price: coin.current_price,
      market_cap: coin.market_cap,
      market_cap_rank: coin.market_cap_rank,
      total_volume: coin.total_volume,
      price_change_24h: coin.price_change_24h,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      circulating_supply: coin.circulating_supply,
      total_supply: coin.total_supply,
      max_supply: coin.max_supply,
      ath: coin.ath,
      ath_change_percentage: coin.ath_change_percentage,
      ath_date: coin.ath_date,
      atl: coin.atl,
      atl_change_percentage: coin.atl_change_percentage,
      atl_date: coin.atl_date,
      ...(sparkline ? { sparkline_in_7d: coin.sparkline_in_7d } : {}),
      ...(price_change_percentage
        ? {
            price_change_percentage_1h: coin.price_change_percentage_1h_in_currency,
            price_change_percentage_24h: coin.price_change_percentage_24h_in_currency,
            price_change_percentage_7d: coin.price_change_percentage_7d_in_currency,
            price_change_percentage_30d: coin.price_change_percentage_30d_in_currency,
            price_change_percentage_1y: coin.price_change_percentage_1y_in_currency,
          }
        : {}),
    }));
  }

  async get_all_coins_in_category(
    category: string,
    vs_currency = "usd",
    order = "market_cap_desc",
    kwargs: {
      sparkline?: boolean;
      price_change_percentage?: string;
      locale?: string;
      precision?: string;
    } = {},
  ): Promise<Array<Record<string, unknown>>> {
    const allCoins: Array<Record<string, unknown>> = [];
    const per_page = 250;
    let page = 1;

    while (true) {
      const coins = await this.get_coins_by_category(
        category,
        vs_currency,
        order,
        per_page,
        page,
        kwargs.sparkline ?? false,
        kwargs.price_change_percentage,
        kwargs.locale ?? "en",
        kwargs.precision,
      );

      if (coins.length === 0) {
        break;
      }

      allCoins.push(...coins);

      if (coins.length < per_page) {
        break;
      }

      page += 1;
      if (page > 1000) {
        break;
      }
    }

    return allCoins;
  }

  async get_category_coin_ids(category: string): Promise<string[]> {
    const coins = await this.get_all_coins_in_category(category, "usd", "market_cap_desc");
    return coins
      .map((coin) => coin.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  async get_category_summary(category: string): Promise<Record<string, unknown>> {
    const coins = await this.get_all_coins_in_category(category, "usd", "market_cap_desc");

    if (coins.length === 0) {
      return {
        category_id: category,
        name: null,
        total_coins: 0,
        total_market_cap: 0,
        total_volume_24h: 0,
        top_10_coins: [],
        market_cap_distribution: {},
      };
    }

    const total_market_cap = coins.reduce((sum, c) => sum + Number(c.market_cap ?? 0), 0);
    const total_volume_24h = coins.reduce((sum, c) => sum + Number(c.total_volume ?? 0), 0);
    const top_10 = coins.slice(0, 10);

    const market_cap_distribution: Record<string, number> = {};
    if (total_market_cap > 0) {
      for (const coin of top_10) {
        const symbol = String(coin.symbol ?? "").toUpperCase();
        const marketCap = Number(coin.market_cap ?? 0);
        market_cap_distribution[symbol] = Math.round((marketCap / total_market_cap) * 10000) / 100;
      }
    }

    let categoryName: string | null = null;
    try {
      const list = await this.get_categories_list();
      categoryName = list.find((cat) => cat.category_id === category)?.name ?? null;
    } catch {
      categoryName = null;
    }

    return {
      category_id: category,
      name: categoryName,
      total_coins: coins.length,
      total_market_cap,
      total_volume_24h,
      top_10_coins: top_10.map((coin) => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        market_cap: coin.market_cap,
        current_price: coin.current_price,
      })),
      market_cap_distribution,
    };
  }

  async search_categories(query: string): Promise<Array<{ category_id: string; name: string }>> {
    const categories = await this.get_categories_list();
    const needle = query.toLowerCase();

    return categories.filter((cat) => {
      return (
        cat.category_id.toLowerCase().includes(needle) || cat.name.toLowerCase().includes(needle)
      );
    });
  }
}

export const SKY_REBRAND_DATE = new Date("2024-09-23T00:00:00.000Z");

export const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  "0G": "zero-gravity",
  "2Z": "doublezero",
  "375AI": "375ai",
  AAVE: "aave",
  ADA: "cardano",
  AERO: "aerodrome-finance",
  APEX: "apex-token-2",
  AKT: "akash-network",
  ALGO: "algorand",
  ANYONE: "airtor-protocol",
  APE: "apecoin",
  APT: "aptos",
  APTOS: "aptos",
  ARB: "arbitrum",
  API3: "api3",
  ASTER: "aster-2",
  ATH: "aethir",
  ATOM: "cosmos",
  AUKI: "auki-labs",
  AVAX: "avalanche-2",
  AXS: "axie-infinity",
  BAL: "balancer",
  BAT: "basic-attention-token",
  BCH: "bitcoin-cash",
  BDX: "beldex",
  BERA: "berachain-bera",
  BLESS: "bless-2",
  BLAST: "blast",
  BNB: "binancecoin",
  BAND: "band-protocol",
  BGB: "bitget-token",
  BONK: "bonk",
  BTC: "bitcoin",
  BUSD: "binance-usd",
  CAKE: "pancakeswap-token",
  CELO: "celo",
  CLOUD: "sanctum-2",
  COMP: "compound-governance-token",
  CRO: "crypto-com-chain",
  CRV: "curve-dao-token",
  CVX: "convex-finance",
  DAI: "dai",
  DOGE: "dogecoin",
  DOT: "polkadot",
  DRIFT: "drift-protocol",
  DYDX: "dydx",
  "DYDX-CHAIN": "dydx-chain",
  DIA: "dia-data",
  EAT: "375ai",
  EGLD: "elrond-erd-2",
  ENA: "ethena",
  ENS: "ethereum-name-service",
  ETC: "ethereum-classic",
  ETH: "ethereum",
  ETHFI: "ether-fi",
  FIL: "filecoin",
  FLOW: "flow",
  FLUID: "instadapp",
  FLR: "flare-networks",
  FLUX: "zelcash",
  FRAX: "frax",
  FTM: "fantom",
  FXS: "frax-share",
  GALA: "gala",
  GEOD: "geodnet",
  GMX: "gmx",
  GNS: "gains-network",
  GNO: "gnosis",
  GRASS: "grass",
  GRT: "the-graph",
  GT: "gatechain-token",
  HASH: "hash-2",
  HBAR: "hedera-hashgraph",
  HEMI: "hemi",
  HNT: "helium",
  HONEY: "hivemapper",
  HYPER: "hyperliquid",
  HTX: "htx-dao",
  ICP: "internet-computer",
  IMX: "immutable-x",
  ILV: "illuvium",
  INJ: "injective-protocol",
  INST: "instadapp",
  IO: "io",
  JITO: "jito-governance-token",
  JTO: "jito-governance-token",
  JUP: "jupiter-exchange-solana",
  KAS: "kaspa",
  KMNO: "kamino",
  KNC: "kyber-network-crystal",
  KCS: "kucoin-shares",
  LAUNCHCOIN: "ben-pasternak",
  LDO: "lido-dao",
  LEO: "leo-token",
  LINEA: "linea",
  LINK: "chainlink",
  LRC: "loopring",
  LTC: "litecoin",
  M: "memecore",
  MANA: "decentraland",
  MATIC: "matic-network",
  MERL: "merlin-chain",
  MKR: "maker",
  MPLX: "metaplex",
  MORPHO: "morpho",
  MYX: "myx-finance",
  NEAR: "near",
  NEO: "neo",
  OPEN: "openledger-2",
  OP: "optimism",
  OKB: "okb",
  ORCA: "orca",
  ORDI: "ordi",
  PENDLE: "pendle",
  PAXG: "pax-gold",
  PEPE: "pepe",
  PDA: "playdapp",
  PIPE: "pipe-network",
  POL: "polygon-ecosystem-token",
  PUMP: "pump-fun",
  PYTH: "pyth-network",
  QNT: "quant-network",
  RAY: "raydium",
  RLB: "rollbit-coin",
  RNDR: "render-token",
  RPL: "rocket-pool",
  RUNE: "thorchain",
  SAGA: "saga-2",
  SAND: "the-sandbox",
  SCR: "scroll",
  SEDA: "seda-2",
  SEI: "sei-network",
  SHIB: "shiba-inu",
  SKY: "sky",
  SPRK: "sparkdex",
  SN115: "cognify",
  SNX: "havven",
  SOL: "solana",
  STG: "stargate-finance",
  STX: "blockstack",
  SUI: "sui",
  SUSHI: "sushi",
  SYS: "syscoin",
  SEND: "suilend",
  TAO: "bittensor",
  THETA: "theta-token",
  TIA: "celestia",
  TON: "the-open-network",
  TRX: "tron",
  TOSHI: "toshi",
  UMA: "uma",
  UDS: "undeads-games",
  UNI: "uniswap",
  USDC: "usd-coin",
  USDE: "ethena-usde",
  USYC: "hashnote-usyc",
  USDT: "tether",
  VENUS: "venus",
  VET: "vechain",
  VIRTUAL: "virtual-protocol",
  SYRUP: "syrup",
  WBT: "whitebit",
  WBTC: "wrapped-bitcoin",
  WETH: "weth",
  WIF: "dogwifcoin",
  WLD: "worldcoin-wld",
  WOO: "woo-network",
  XLM: "stellar",
  XMR: "monero",
  XAUT: "tether-gold",
  XNET: "xnet-mobile-2",
  XPL: "plasma",
  XRP: "ripple",
  XTZ: "tezos",
  YFI: "yearn-finance",
  ZEC: "zcash",
  ZK: "zksync",
  ZRX: "0x",
  AIOZ: "aioz-network",
  AITECH: "solidus-aitech",
  AR: "arweave",
  AUCTION: "auction",
  AVAIL: "avail",
  BABYDOGE: "baby-doge-coin",
  BEAM: "beam",
  BLOCK: "blockstack",
  BTT: "bittorrent",
  CGPT: "chaingpt",
  CHR: "chromaway",
  CTSI: "cartesi",
  DEXE: "dexe",
  DYM: "dymension",
  ENJ: "enjincoin",
  EULER: "euler",
  FET: "fetch-ai",
  FLOKI: "floki",
  FORM: "four",
  GOMINING: "gmt-token",
  LGCT: "legacy-token",
  MOCA: "mocaverse",
  NOT: "notcoin",
  RON: "ronin",
  SKL: "skale",
  SUPER: "superfarm",
  WEMIX: "wemix-token",
  HYPE: "hyperliquid",
  IOTA: "iota",
  IP: "story-2",
  JASMY: "jasmycoin",
  LAVA: "lava-network",
  MNT: "mantle",
  MOVE: "movement",
  ONDO: "ondo-finance",
  OUSG: "ondo-us-dollar-yield",
  PENGU: "pudgy-penguins",
  RENDER: "render-token",
  SAROS: "saros-finance",
  PAAL: "paal-ai",
  SPX: "spx6900",
  STRK: "starknet",
  TRUMP: "maga",
  XDC: "xdce-crowd-sale",
  BELIEVE: "believe-coin",
  CLANKER: "clanker",
  FOUR: "fourcoin",
  KAITO: "kaito",
  LPT: "livepeer",
  META: "meta-2-2",
  MET: "meteora",
  ZORA: "zora",
};

export const TOKEN_ALIASES: Record<string, string> = {
  WETH: "ETH",
  WBTC: "BTC",
  STETH: "ETH",
  RETH: "ETH",
  CBETH: "ETH",
  MATIC: "POL",
  "UNI-V2": "UNI",
  "UNI-V3": "UNI",
  "AAVE-V2": "AAVE",
  "AAVE-V3": "AAVE",
  INST: "FLUID",
  KAMINO: "KMNO",
  "USDC.E": "USDC",
  "USDT.E": "USDT",
  "DAI.E": "DAI",
  "SOL.W": "SOL",
  "BNB.BSC": "BNB",
  ANT: "ARJ",
};

export const ETH_TOP_10_TOKENS = [
  "UNI",
  "AAVE",
  "SKY",
  "ENS",
  "PENDLE",
  "FLUID",
  "LDO",
  "ENA",
  "CRV",
  "MORPHO",
] as const;

export const SOL_TOP_10_TOKENS = [
  "PUMP",
  "BONK",
  "JUP",
  "RAY",
  "MPLX",
  "ORCA",
  "KMNO",
  "JITO",
  "DRIFT",
  "CLOUD",
] as const;

export const PROBLEMATIC_TOKENS = new Set(["FLUID", "MORPHO"]);

export function get_coingecko_id_from_symbol(
  symbol: string,
  query_date?: Date,
): string | null {
  let normalized = symbol.toUpperCase();

  if (TOKEN_ALIASES[normalized]) {
    normalized = TOKEN_ALIASES[normalized];
  }

  if (normalized === "MKR" && query_date && query_date >= SKY_REBRAND_DATE) {
    return "sky";
  }
  if (normalized === "SKY" && query_date && query_date < SKY_REBRAND_DATE) {
    return "maker";
  }

  return TOKEN_TO_COINGECKO_ID[normalized] ?? null;
}

export function get_symbol_from_coingecko_id(coingecko_id: string): string | null {
  for (const [symbol, id] of Object.entries(TOKEN_TO_COINGECKO_ID)) {
    if (id === coingecko_id) {
      return symbol;
    }
  }
  return null;
}

export function is_problematic_token(symbol: string): boolean {
  return PROBLEMATIC_TOKENS.has(symbol.toUpperCase());
}

export function get_multiple_coingecko_ids(
  symbols: readonly string[],
  query_date?: Date,
): Record<string, string | null> {
  return Object.fromEntries(
    symbols.map((symbol) => [symbol, get_coingecko_id_from_symbol(symbol, query_date)]),
  );
}

export function validate_token_symbols(symbols: string[]): Record<string, boolean> {
  return Object.fromEntries(
    symbols.map((symbol) => [symbol, get_coingecko_id_from_symbol(symbol) !== null]),
  );
}

export function get_token_list_ids(token_list_name: string): string[] | null {
  const tokenLists: Record<string, readonly string[]> = {
    ETH_TOP_10: ETH_TOP_10_TOKENS,
    SOL_TOP_10: SOL_TOP_10_TOKENS,
  };
  const tokens = tokenLists[token_list_name.toUpperCase()];
  if (!tokens) {
    return null;
  }

  const ids: string[] = [];
  for (const token of tokens) {
    const id = get_coingecko_id_from_symbol(token);
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

export const __version__ = "1.0.0";
export const __author__ = "BWR Tools";
export const __license__ = "MIT";

export function create_client(options: CoinGeckoAPIWrapperOptions = {}): CoinGeckoAPIWrapper {
  return new CoinGeckoAPIWrapper(options);
}

export async function create_async_client(
  options: CoinGeckoAPIWrapperOptions = {},
): Promise<AsyncCoinGeckoAPIWrapper> {
  return new AsyncCoinGeckoAPIWrapper(options);
}

export function get_version(): string {
  return __version__;
}

export async function test_connection(api_key?: string): Promise<boolean> {
  try {
    const client = new CoinGeckoAPIWrapper(api_key ? { api_key } : {});
    return await client.test_connection();
  } catch {
    return false;
  }
}

export const Simple = SimpleEndpoints;
export const Coins = CoinsEndpoints;
export const Markets = MarketsEndpoints;
export const Search = SearchEndpoints;
export const Derivatives = DerivativesEndpoints;
export const GlobalData = GlobalDataEndpoints;
