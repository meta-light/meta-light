import { DefiLlama } from "@defillama/api";

export type DefiLlamaSdkOptions = ConstructorParameters<typeof DefiLlama>[0];

export function createDefiLlamaSdkClient(options?: DefiLlamaSdkOptions) {
  return new DefiLlama(options);
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type QueryValue = string | number | boolean;
export type QueryParams = Record<string, QueryValue | null | undefined>;

export type FetchHeadersLike = {
  get(name: string): string | null;
};

export type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: FetchHeadersLike;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

export type DefiLlamaClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  bridgeBaseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  extraHeaders?: Record<string, string>;
  fetch?: FetchLike;
};

export class DefiLlamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefiLlamaError";
  }
}

export class ConfigurationError extends DefiLlamaError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class AuthenticationError extends DefiLlamaError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends DefiLlamaError {
  retryAfter: number | null;

  constructor(message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ResourceNotFoundError extends DefiLlamaError {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class ProtocolNotFoundError extends ResourceNotFoundError {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolNotFoundError";
  }
}

export class BridgeNotFoundError extends ResourceNotFoundError {
  constructor(message: string) {
    super(message);
    this.name = "BridgeNotFoundError";
  }
}

export class APIError extends DefiLlamaError {
  statusCode: number | null;
  responseBody: string | null;

  constructor(
    message: string,
    statusCode: number | null = null,
    responseBody: string | null = null,
  ) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class TimeoutError extends DefiLlamaError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class NetworkError extends DefiLlamaError {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function encodePathSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function toBoolString(value: boolean): string {
  return value ? "true" : "false";
}

function cleanQuery(
  params?: QueryParams,
): Record<string, QueryValue> | undefined {
  if (!params) return undefined;
  const next: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function applyQuery(url: URL, params?: QueryParams): URL {
  const query = cleanQuery(params);
  if (!query) return url;
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

function joinUrl(baseUrl: string, endpoint: string): string {
  const normalized = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return new URL(normalized, withTrailingSlash(baseUrl)).toString();
}

export class DefiLlamaClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly bridgeBaseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBackoffMs: number;
  readonly extraHeaders: Record<string, string>;

  private readonly fetchImpl: FetchLike;

  constructor(options: DefiLlamaClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DEFILLAMA_PRO_API_KEY;
    if (!apiKey) {
      throw new ConfigurationError(
        "API key required. Set DEFILLAMA_PRO_API_KEY environment variable or pass apiKey.",
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? "https://pro-api.llama.fi";
    this.bridgeBaseUrl = options.bridgeBaseUrl ?? "https://bridges.llama.fi";
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxRetries = options.maxRetries ?? 5;
    this.retryBackoffMs = options.retryBackoffMs ?? 1_000;
    this.extraHeaders = options.extraHeaders ?? {};

    const nativeFetch = globalThis.fetch as unknown as FetchLike | undefined;
    this.fetchImpl =
      options.fetch ??
      nativeFetch ??
      (() => {
        throw new ConfigurationError(
          "fetch is not available in this environment",
        );
      });

    if (this.timeoutMs <= 0) {
      throw new ConfigurationError("timeoutMs must be positive");
    }
    if (this.maxRetries <= 0) {
      throw new ConfigurationError("maxRetries must be positive");
    }
    if (this.retryBackoffMs <= 0) {
      throw new ConfigurationError("retryBackoffMs must be positive");
    }
  }

  async close(): Promise<void> {
    // Kept for API parity with the Python client. No persistent resources here.
  }

  private buildUrl(endpoint: string, useBridgeApi: boolean): string {
    if (useBridgeApi) {
      return joinUrl(this.bridgeBaseUrl, endpoint);
    }

    const prefixedPath = `${stripSlashes(this.apiKey)}/${endpoint.replace(/^\/+/, "")}`;
    return joinUrl(this.baseUrl, prefixedPath);
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

  private async safeReadText(response: FetchResponseLike): Promise<string> {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }

  private async handleError(response: FetchResponseLike): Promise<never> {
    const statusCode = response.status;
    const errorBody = await this.safeReadText(response);

    if (statusCode === 401 || statusCode === 403) {
      throw new AuthenticationError(
        `Authentication failed: ${errorBody || "Invalid API key"}`,
      );
    }

    if (statusCode === 404) {
      if (response.url.includes("/protocol/")) {
        throw new ProtocolNotFoundError(
          `Protocol not found: ${errorBody || response.url}`,
        );
      }
      if (response.url.includes("/bridge/")) {
        throw new BridgeNotFoundError(
          `Bridge not found: ${errorBody || response.url}`,
        );
      }
      throw new ResourceNotFoundError(
        `Resource not found: ${errorBody || response.url}`,
      );
    }

    if (statusCode === 429) {
      const retryHeader = response.headers.get("retry-after");
      const retryAfter = retryHeader
        ? Number.parseInt(retryHeader, 10)
        : Number.NaN;
      throw new RateLimitError(
        `Rate limit exceeded: ${errorBody || "Too many requests"}`,
        Number.isFinite(retryAfter) ? retryAfter : null,
      );
    }

    if (statusCode >= 500) {
      throw new APIError(
        `Server error: ${errorBody || "Internal server error"}`,
        statusCode,
        errorBody || null,
      );
    }

    throw new APIError(
      `API error: ${errorBody || `HTTP ${statusCode}`}`,
      statusCode,
      errorBody || null,
    );
  }

  private async request(
    method: "GET" | "POST",
    endpoint: string,
    options: {
      params?: QueryParams;
      body?: JsonValue;
      useBridgeApi?: boolean;
    } = {},
  ): Promise<unknown> {
    const url = applyQuery(
      new URL(this.buildUrl(endpoint, options.useBridgeApi ?? false)),
      options.params,
    ).toString();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          "User-Agent": "defillama-client/1.0.0",
          ...this.extraHeaders,
        };

        const init: {
          method: "GET" | "POST";
          headers: Record<string, string>;
          body?: string;
          signal: AbortSignal;
        } = {
          method,
          headers,
          signal: controller.signal,
        };

        if (options.body !== undefined) {
          init.body = JSON.stringify(options.body);
          init.headers["Content-Type"] = "application/json";
        }

        const response = await this.fetchImpl(url, init);

        if (!response.ok) {
          await this.handleError(response);
        }

        clearTimeout(timeoutId);
        return this.parseResponse(response);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DefiLlamaError) {
          throw error;
        }

        const isAbort = error instanceof Error && error.name === "AbortError";
        lastError = isAbort
          ? new TimeoutError(`Request timed out after ${this.timeoutMs}ms`)
          : new NetworkError(
              error instanceof Error ? error.message : String(error),
            );

        if (attempt < this.maxRetries - 1) {
          const waitMs = this.retryBackoffMs * 2 ** attempt;
          await delay(waitMs);
          continue;
        }
      }
    }

    throw lastError ?? new NetworkError("Request failed");
  }

  protected async get(
    endpoint: string,
    params?: QueryParams,
    useBridgeApi: boolean = false,
  ): Promise<unknown> {
    return this.request("GET", endpoint, { params, useBridgeApi });
  }

  protected async post(
    endpoint: string,
    body?: JsonValue,
    params?: QueryParams,
    useBridgeApi: boolean = false,
  ): Promise<unknown> {
    return this.request("POST", endpoint, { body, params, useBridgeApi });
  }

  // Account endpoints
  async get_usage(): Promise<unknown> {
    return this.get("/usage/APIKEY");
  }

  async get_usage_async(): Promise<unknown> {
    return this.get_usage();
  }

  // TVL endpoints
  async get_protocols(): Promise<unknown> {
    return this.get("/api/protocols");
  }

  async get_protocol(protocol: string): Promise<unknown> {
    return this.get(`/api/protocol/${encodePathSegment(protocol)}`);
  }

  async get_tvl(protocol: string): Promise<number> {
    const data = await this.get(`/api/tvl/${encodePathSegment(protocol)}`);
    return Number(data);
  }

  async get_token_protocols(symbol: string): Promise<unknown> {
    return this.get(`/api/tokenProtocols/${encodePathSegment(symbol)}`);
  }

  async get_inflows(protocol: string, timestamp: number): Promise<unknown> {
    return this.get(
      `/api/inflows/${encodePathSegment(protocol)}/${encodePathSegment(timestamp)}`,
    );
  }

  async get_chains(): Promise<unknown> {
    return this.get("/api/v2/chains");
  }

  async get_historical_chain_tvl(): Promise<unknown> {
    return this.get("/api/v2/historicalChainTvl");
  }

  async get_historical_chain_tvl_by_chain(chain: string): Promise<unknown> {
    return this.get(`/api/v2/historicalChainTvl/${encodePathSegment(chain)}`);
  }

  async get_chain_assets(): Promise<unknown> {
    return this.get("/api/chainAssets");
  }

  async get_protocols_async(): Promise<unknown> {
    return this.get_protocols();
  }

  async get_protocol_async(protocol: string): Promise<unknown> {
    return this.get_protocol(protocol);
  }

  async get_tvl_async(protocol: string): Promise<number> {
    return this.get_tvl(protocol);
  }

  async get_token_protocols_async(symbol: string): Promise<unknown> {
    return this.get_token_protocols(symbol);
  }

  async get_inflows_async(
    protocol: string,
    timestamp: number,
  ): Promise<unknown> {
    return this.get_inflows(protocol, timestamp);
  }

  async get_chains_async(): Promise<unknown> {
    return this.get_chains();
  }

  async get_historical_chain_tvl_async(): Promise<unknown> {
    return this.get_historical_chain_tvl();
  }

  async get_historical_chain_tvl_by_chain_async(
    chain: string,
  ): Promise<unknown> {
    return this.get_historical_chain_tvl_by_chain(chain);
  }

  async get_chain_assets_async(): Promise<unknown> {
    return this.get_chain_assets();
  }

  // Price endpoints
  async get_current_prices(
    coins: string,
    search_width?: string,
  ): Promise<unknown> {
    const params = search_width ? { searchWidth: search_width } : undefined;
    return this.get(
      `/coins/prices/current/${encodePathSegment(coins)}`,
      params,
    );
  }

  async get_historical_prices(
    timestamp: number,
    coins: string,
    search_width?: string,
  ): Promise<unknown> {
    const params = search_width ? { searchWidth: search_width } : undefined;
    return this.get(
      `/coins/prices/historical/${encodePathSegment(timestamp)}/${encodePathSegment(coins)}`,
      params,
    );
  }

  async get_batch_historical_prices(
    coins_timestamps: Record<string, number[]>,
  ): Promise<unknown> {
    return this.post("/coins/batchHistorical", { coins: coins_timestamps });
  }

  async get_price_chart(
    coins: string,
    options: { period?: string; span?: number; search_width?: string } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      period: options.period,
      span: options.span,
      searchWidth: options.search_width,
    };
    return this.get(`/coins/chart/${encodePathSegment(coins)}`, params);
  }

  async get_price_percentage_change(
    coins: string,
    options: {
      timestamp?: number;
      look_forward?: boolean;
      period?: string;
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      timestamp: options.timestamp,
      lookForward:
        options.look_forward === undefined
          ? undefined
          : toBoolString(options.look_forward),
      period: options.period,
    };
    return this.get(`/coins/percentage/${encodePathSegment(coins)}`, params);
  }

  async get_first_prices(coins: string): Promise<unknown> {
    return this.get(`/coins/prices/first/${encodePathSegment(coins)}`);
  }

  async get_block_at_timestamp(
    chain: string,
    timestamp: number,
  ): Promise<unknown> {
    return this.get(
      `/coins/block/${encodePathSegment(chain)}/${encodePathSegment(timestamp)}`,
    );
  }

  async get_current_prices_async(
    coins: string,
    search_width?: string,
  ): Promise<unknown> {
    return this.get_current_prices(coins, search_width);
  }

  async get_historical_prices_async(
    timestamp: number,
    coins: string,
    search_width?: string,
  ): Promise<unknown> {
    return this.get_historical_prices(timestamp, coins, search_width);
  }

  async get_batch_historical_prices_async(
    coins_timestamps: Record<string, number[]>,
  ): Promise<unknown> {
    return this.get_batch_historical_prices(coins_timestamps);
  }

  async get_price_chart_async(
    coins: string,
    options: { period?: string; span?: number; search_width?: string } = {},
  ): Promise<unknown> {
    return this.get_price_chart(coins, options);
  }

  async get_price_percentage_change_async(
    coins: string,
    options: {
      timestamp?: number;
      look_forward?: boolean;
      period?: string;
    } = {},
  ): Promise<unknown> {
    return this.get_price_percentage_change(coins, options);
  }

  async get_first_prices_async(coins: string): Promise<unknown> {
    return this.get_first_prices(coins);
  }

  async get_block_at_timestamp_async(
    chain: string,
    timestamp: number,
  ): Promise<unknown> {
    return this.get_block_at_timestamp(chain, timestamp);
  }

  // Yields endpoints
  async get_yield_pools(): Promise<unknown> {
    return this.get("/yields/pools");
  }

  async get_yield_pools_old(): Promise<unknown> {
    return this.get("/yields/poolsOld");
  }

  async get_yield_chart(pool: string): Promise<unknown> {
    return this.get(`/yields/chart/${encodePathSegment(pool)}`);
  }

  async get_borrow_pools(): Promise<unknown> {
    return this.get("/yields/poolsBorrow");
  }

  async get_lend_borrow_chart(pool: string): Promise<unknown> {
    return this.get(`/yields/chartLendBorrow/${encodePathSegment(pool)}`);
  }

  async get_perps(): Promise<unknown> {
    return this.get("/yields/perps");
  }

  async get_lsd_rates(): Promise<unknown> {
    return this.get("/yields/lsdRates");
  }

  async get_yield_pools_async(): Promise<unknown> {
    return this.get_yield_pools();
  }

  async get_yield_pools_old_async(): Promise<unknown> {
    return this.get_yield_pools_old();
  }

  async get_yield_chart_async(pool: string): Promise<unknown> {
    return this.get_yield_chart(pool);
  }

  async get_borrow_pools_async(): Promise<unknown> {
    return this.get_borrow_pools();
  }

  async get_lend_borrow_chart_async(pool: string): Promise<unknown> {
    return this.get_lend_borrow_chart(pool);
  }

  async get_perps_async(): Promise<unknown> {
    return this.get_perps();
  }

  async get_lsd_rates_async(): Promise<unknown> {
    return this.get_lsd_rates();
  }

  // Users endpoints
  async get_active_users(): Promise<unknown> {
    return this.get("/api/activeUsers");
  }

  async get_user_data(
    data_type: "activeUsers" | "uniqueActiveUsers" | "dailyTxs" | "gasUsd",
    protocol_id: string,
  ): Promise<unknown> {
    return this.get(
      `/api/userData/${encodePathSegment(data_type)}/${encodePathSegment(protocol_id)}`,
    );
  }

  async get_active_users_async(): Promise<unknown> {
    return this.get_active_users();
  }

  async get_user_data_async(
    data_type: "activeUsers" | "uniqueActiveUsers" | "dailyTxs" | "gasUsd",
    protocol_id: string,
  ): Promise<unknown> {
    return this.get_user_data(data_type, protocol_id);
  }

  // Volumes endpoints
  async get_dexs_overview(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
      data_type?: "dailyVolume" | "totalVolume";
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      excludeTotalDataChart: toBoolString(
        options.exclude_total_data_chart ?? false,
      ),
      excludeTotalDataChartBreakdown: toBoolString(
        options.exclude_total_data_chart_breakdown ?? false,
      ),
      dataType: options.data_type ?? "dailyVolume",
    };
    return this.get("/api/overview/dexs", params);
  }

  async get_dexs_by_chain(
    chain: string,
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      excludeTotalDataChart: toBoolString(
        options.exclude_total_data_chart ?? false,
      ),
      excludeTotalDataChartBreakdown: toBoolString(
        options.exclude_total_data_chart_breakdown ?? false,
      ),
    };
    return this.get(`/api/overview/dexs/${encodePathSegment(chain)}`, params);
  }

  async get_dex_protocol(
    protocol: string,
    data_type: "dailyVolume" | "totalVolume" = "dailyVolume",
  ): Promise<unknown> {
    return this.get(`/api/summary/dexs/${encodePathSegment(protocol)}`, {
      dataType: data_type,
    });
  }

  async get_options_overview(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      excludeTotalDataChart: toBoolString(
        options.exclude_total_data_chart ?? false,
      ),
      excludeTotalDataChartBreakdown: toBoolString(
        options.exclude_total_data_chart_breakdown ?? false,
      ),
    };
    return this.get("/api/overview/options", params);
  }

  async get_options_by_chain(chain: string): Promise<unknown> {
    return this.get(`/api/overview/options/${encodePathSegment(chain)}`);
  }

  async get_options_protocol(
    protocol: string,
    data_type?:
      | "dailyNotionalVolume"
      | "dailyPremiumVolume"
      | "dailyVolume"
      | "totalVolume",
  ): Promise<unknown> {
    const params = data_type ? { dataType: data_type } : undefined;
    return this.get(
      `/api/summary/options/${encodePathSegment(protocol)}`,
      params,
    );
  }

  async get_derivatives_overview(): Promise<unknown> {
    return this.get("/api/overview/derivatives");
  }

  async get_derivatives_protocol(protocol: string): Promise<unknown> {
    return this.get(`/api/summary/derivatives/${encodePathSegment(protocol)}`);
  }

  async get_dexs_overview_async(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
      data_type?: "dailyVolume" | "totalVolume";
    } = {},
  ): Promise<unknown> {
    return this.get_dexs_overview(options);
  }

  async get_dexs_by_chain_async(
    chain: string,
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
    } = {},
  ): Promise<unknown> {
    return this.get_dexs_by_chain(chain, options);
  }

  async get_dex_protocol_async(
    protocol: string,
    data_type: "dailyVolume" | "totalVolume" = "dailyVolume",
  ): Promise<unknown> {
    return this.get_dex_protocol(protocol, data_type);
  }

  async get_options_overview_async(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
    } = {},
  ): Promise<unknown> {
    return this.get_options_overview(options);
  }

  async get_options_by_chain_async(chain: string): Promise<unknown> {
    return this.get_options_by_chain(chain);
  }

  async get_options_protocol_async(
    protocol: string,
    data_type?:
      | "dailyNotionalVolume"
      | "dailyPremiumVolume"
      | "dailyVolume"
      | "totalVolume",
  ): Promise<unknown> {
    return this.get_options_protocol(protocol, data_type);
  }

  async get_derivatives_overview_async(): Promise<unknown> {
    return this.get_derivatives_overview();
  }

  async get_derivatives_protocol_async(protocol: string): Promise<unknown> {
    return this.get_derivatives_protocol(protocol);
  }

  // Fees endpoints
  async get_fees_overview(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
      data_type?: "dailyFees" | "dailyRevenue" | "dailyHoldersRevenue";
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      excludeTotalDataChart: toBoolString(
        options.exclude_total_data_chart ?? true,
      ),
      excludeTotalDataChartBreakdown: toBoolString(
        options.exclude_total_data_chart_breakdown ?? true,
      ),
      dataType: options.data_type ?? "dailyFees",
    };
    return this.get("/api/overview/fees", params);
  }

  async get_fees_by_chain(
    chain: string,
    data_type:
      | "dailyFees"
      | "dailyRevenue"
      | "dailyHoldersRevenue" = "dailyFees",
  ): Promise<unknown> {
    return this.get(`/api/overview/fees/${encodePathSegment(chain)}`, {
      dataType: data_type,
    });
  }

  async get_protocol_fees(
    protocol: string,
    data_type:
      | "dailyFees"
      | "dailyRevenue"
      | "dailyHoldersRevenue" = "dailyFees",
  ): Promise<unknown> {
    return this.get(`/api/summary/fees/${encodePathSegment(protocol)}`, {
      dataType: data_type,
    });
  }

  async get_fees_overview_async(
    options: {
      exclude_total_data_chart?: boolean;
      exclude_total_data_chart_breakdown?: boolean;
      data_type?: "dailyFees" | "dailyRevenue" | "dailyHoldersRevenue";
    } = {},
  ): Promise<unknown> {
    return this.get_fees_overview(options);
  }

  async get_fees_by_chain_async(
    chain: string,
    data_type:
      | "dailyFees"
      | "dailyRevenue"
      | "dailyHoldersRevenue" = "dailyFees",
  ): Promise<unknown> {
    return this.get_fees_by_chain(chain, data_type);
  }

  async get_protocol_fees_async(
    protocol: string,
    data_type:
      | "dailyFees"
      | "dailyRevenue"
      | "dailyHoldersRevenue" = "dailyFees",
  ): Promise<unknown> {
    return this.get_protocol_fees(protocol, data_type);
  }

  // Emissions endpoints
  async get_all_emissions(): Promise<unknown> {
    return this.get("/api/emissions");
  }

  async get_emission_detail(protocol: string): Promise<unknown> {
    return this.get(`/api/emission/${encodePathSegment(protocol)}`);
  }

  async get_all_emissions_async(): Promise<unknown> {
    return this.get_all_emissions();
  }

  async get_emission_detail_async(protocol: string): Promise<unknown> {
    return this.get_emission_detail(protocol);
  }

  // Ecosystem endpoints
  async get_categories(): Promise<unknown> {
    return this.get("/api/categories");
  }

  async get_forks(): Promise<unknown> {
    return this.get("/api/forks");
  }

  async get_oracles(): Promise<unknown> {
    return this.get("/api/oracles");
  }

  async get_entities(): Promise<unknown> {
    return this.get("/api/entities");
  }

  async get_treasuries(): Promise<unknown> {
    return this.get("/api/treasuries");
  }

  async get_hacks(): Promise<unknown> {
    return this.get("/api/hacks");
  }

  async get_raises(): Promise<unknown> {
    return this.get("/api/raises");
  }

  async get_historical_liquidity(token: string): Promise<unknown> {
    return this.get(`/api/historicalLiquidity/${encodePathSegment(token)}`);
  }

  async get_categories_async(): Promise<unknown> {
    return this.get_categories();
  }

  async get_forks_async(): Promise<unknown> {
    return this.get_forks();
  }

  async get_oracles_async(): Promise<unknown> {
    return this.get_oracles();
  }

  async get_entities_async(): Promise<unknown> {
    return this.get_entities();
  }

  async get_treasuries_async(): Promise<unknown> {
    return this.get_treasuries();
  }

  async get_hacks_async(): Promise<unknown> {
    return this.get_hacks();
  }

  async get_raises_async(): Promise<unknown> {
    return this.get_raises();
  }

  async get_historical_liquidity_async(token: string): Promise<unknown> {
    return this.get_historical_liquidity(token);
  }

  // ETF endpoints
  async get_etf_overview(): Promise<unknown> {
    return this.get("/etfs/overview");
  }

  async get_eth_etf_overview(): Promise<unknown> {
    return this.get("/etfs/overviewEth");
  }

  async get_etf_history(): Promise<unknown> {
    return this.get("/etfs/history");
  }

  async get_eth_etf_history(): Promise<unknown> {
    return this.get("/etfs/historyEth");
  }

  async get_fdv_performance(
    period: "7" | "30" | "ytd" | "365",
  ): Promise<unknown> {
    return this.get(`/fdv/performance/${encodePathSegment(period)}`);
  }

  async get_etf_overview_async(): Promise<unknown> {
    return this.get_etf_overview();
  }

  async get_eth_etf_overview_async(): Promise<unknown> {
    return this.get_eth_etf_overview();
  }

  async get_etf_history_async(): Promise<unknown> {
    return this.get_etf_history();
  }

  async get_eth_etf_history_async(): Promise<unknown> {
    return this.get_eth_etf_history();
  }

  async get_fdv_performance_async(
    period: "7" | "30" | "ytd" | "365",
  ): Promise<unknown> {
    return this.get_fdv_performance(period);
  }

  // Bridge endpoints
  async get_bridges(include_chains: boolean = false): Promise<unknown> {
    const params = include_chains ? { includeChains: "true" } : undefined;
    return this.get("/bridges", params, true);
  }

  async get_bridge_detail(bridge_id: number): Promise<unknown> {
    return this.get(`/bridge/${encodePathSegment(bridge_id)}`, undefined, true);
  }

  async get_bridge_volume(chain: string): Promise<unknown> {
    return this.get(
      `/bridgevolume/${encodePathSegment(chain)}`,
      undefined,
      true,
    );
  }

  async get_bridge_day_stats(
    timestamp: number,
    chain: string,
  ): Promise<unknown> {
    return this.get(
      `/bridgedaystats/${encodePathSegment(timestamp)}/${encodePathSegment(chain)}`,
      undefined,
      true,
    );
  }

  async get_bridge_transactions(
    bridge_id: number,
    options: {
      limit?: number;
      start_timestamp?: number;
      end_timestamp?: number;
      source_chain?: string;
      address?: string;
    } = {},
  ): Promise<unknown> {
    const params: QueryParams = {
      limit: options.limit ?? 100,
      startTimestamp: options.start_timestamp,
      endTimestamp: options.end_timestamp,
      sourceChain: options.source_chain,
      address: options.address,
    };
    return this.get(
      `/transactions/${encodePathSegment(bridge_id)}`,
      params,
      true,
    );
  }

  async get_bridges_async(include_chains: boolean = false): Promise<unknown> {
    return this.get_bridges(include_chains);
  }

  async get_bridge_detail_async(bridge_id: number): Promise<unknown> {
    return this.get_bridge_detail(bridge_id);
  }

  async get_bridge_volume_async(chain: string): Promise<unknown> {
    return this.get_bridge_volume(chain);
  }

  async get_bridge_day_stats_async(
    timestamp: number,
    chain: string,
  ): Promise<unknown> {
    return this.get_bridge_day_stats(timestamp, chain);
  }

  async get_bridge_transactions_async(
    bridge_id: number,
    options: {
      limit?: number;
      start_timestamp?: number;
      end_timestamp?: number;
      source_chain?: string;
      address?: string;
    } = {},
  ): Promise<unknown> {
    return this.get_bridge_transactions(bridge_id, options);
  }

  // Stablecoin endpoints
  async get_stablecoins(include_prices: boolean = false): Promise<unknown> {
    return this.get("/stablecoins/stablecoins", {
      includePrices: toBoolString(include_prices),
    });
  }

  async get_stablecoin_chains(): Promise<unknown> {
    return this.get("/stablecoins/stablecoinchains");
  }

  async get_stablecoin_charts_all(stablecoin?: number): Promise<unknown> {
    const params = stablecoin === undefined ? undefined : { stablecoin };
    return this.get("/stablecoins/stablecoincharts/all", params);
  }

  async get_stablecoin_charts_chain(
    chain: string,
    stablecoin?: number,
  ): Promise<unknown> {
    const params = stablecoin === undefined ? undefined : { stablecoin };
    return this.get(
      `/stablecoins/stablecoincharts/${encodePathSegment(chain)}`,
      params,
    );
  }

  async get_stablecoin_detail(asset: string): Promise<unknown> {
    return this.get(`/stablecoins/stablecoin/${encodePathSegment(asset)}`);
  }

  async get_stablecoin_dominance(
    chain: string,
    stablecoin?: number,
  ): Promise<unknown> {
    const params = stablecoin === undefined ? undefined : { stablecoin };
    return this.get(
      `/stablecoins/stablecoindominance/${encodePathSegment(chain)}`,
      params,
    );
  }

  async get_stablecoin_prices(): Promise<unknown> {
    return this.get("/stablecoins/stablecoinprices");
  }

  async get_stablecoins_async(
    include_prices: boolean = false,
  ): Promise<unknown> {
    return this.get_stablecoins(include_prices);
  }

  async get_stablecoin_chains_async(): Promise<unknown> {
    return this.get_stablecoin_chains();
  }

  async get_stablecoin_charts_all_async(stablecoin?: number): Promise<unknown> {
    return this.get_stablecoin_charts_all(stablecoin);
  }

  async get_stablecoin_charts_chain_async(
    chain: string,
    stablecoin?: number,
  ): Promise<unknown> {
    return this.get_stablecoin_charts_chain(chain, stablecoin);
  }

  async get_stablecoin_detail_async(asset: string): Promise<unknown> {
    return this.get_stablecoin_detail(asset);
  }

  async get_stablecoin_dominance_async(
    chain: string,
    stablecoin?: number,
  ): Promise<unknown> {
    return this.get_stablecoin_dominance(chain, stablecoin);
  }

  async get_stablecoin_prices_async(): Promise<unknown> {
    return this.get_stablecoin_prices();
  }
}

export class AsyncDefiLlamaClient extends DefiLlamaClient {}

export const DeFiLlamaAPI = DefiLlamaClient;

export function createDefiLlamaClient(
  options?: DefiLlamaClientOptions,
): DefiLlamaClient {
  return new DefiLlamaClient(options);
}
