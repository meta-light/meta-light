async function fetchTRPC<T>(baseUrl: string, endpoint: string, input: any): Promise<T> {
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("input", JSON.stringify(input));
  const response = await fetch(url.toString());
  if (!response.ok) {throw new Error(`tRPC request failed: ${response.statusText}`);}
  return response.json();
}

async function fetchREST<T>(url: string, params: Record<string, any> = {}): Promise<T> {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {urlObj.searchParams.set(key, String(value));}
  });
  const response = await fetch(urlObj.toString());
  if (!response.ok) {throw new Error(`REST request failed: ${response.statusText}`);}
  return response.json();
}

const X402_BASE_URL = "https://www.x402scan.com/api/trpc";

export const x402Api = {
  getAgents: (params: {
    timeframe?: number;
    sorting?: { id: string; desc: boolean };
    pagination?: { page: number; page_size: number };
  }) => {
    return fetchTRPC(X402_BASE_URL, "public.agents.list", {
      json: {
        timeframe: params.timeframe ?? 1,
        sorting: params.sorting ?? { id: "score", desc: true },
        pagination: params.pagination ?? { page: 1, page_size: 10 },
      },
    });
  },
  getNetworkStats: (params: { numBuckets?: number; timeframe?: number; chain?: string | null }) => {
    return fetchTRPC(X402_BASE_URL, "networks.bucketedStatistics", {
      json: {
        numBuckets: params.numBuckets ?? 48,
        timeframe: params.timeframe ?? 0,
        chain: params.chain ?? null,
      },
      meta: { values: { chain: ["undefined"] }, v: 1 },
    });
  },
  getFacilitatorStats: (params: { numBuckets?: number; timeframe?: number; chain?: string | null }) => {
    return fetchTRPC(X402_BASE_URL, "public.facilitators.bucketedStatistics", {
      json: {
        numBuckets: params.numBuckets ?? 48,
        timeframe: params.timeframe ?? 0,
        chain: params.chain ?? null,
      },
      meta: { values: { chain: ["undefined"] }, v: 1 },
    });
  },
  getOriginDetails: (address: string) => {return fetchTRPC(X402_BASE_URL, "public.origins.list.origins", {json: { address }});},
  getTransfers: (params: {
    chain?: string | null;
    pagination?: { page: number; page_size: number };
    sorting?: { id: string; desc: boolean };
    timeframe?: number;
  }) => {
    return fetchTRPC(X402_BASE_URL, "public.transfers.list", {
      json: {
        chain: params.chain ?? null,
        pagination: params.pagination ?? { page: 1, page_size: 10 },
        sorting: params.sorting ?? { id: "block_timestamp", desc: true },
        timeframe: params.timeframe ?? 30,
      },
      meta: { values: { chain: ["undefined"] }, v: 1 },
    });
  },
  getBazaarSellers: (params: {
    timeframe?: number;
    tags?: string[];
    pagination?: { page_size: number };
  }) => {
    return fetchTRPC(X402_BASE_URL, "public.sellers.bazaar.list", {
      json: {
        timeframe: params.timeframe ?? 0,
        tags: params.tags,
        pagination: params.pagination ?? { page_size: 20 },
      },
    });
  },
  getSellerStats: (type: "all" | "bazaar", metric: "overall" | "bucketed", timeframe: number = 0) => {
    const endpoint = `public.sellers.${type}.stats.${metric}`;
    return fetchTRPC(X402_BASE_URL, endpoint, { json: { timeframe } });
  },
};

const SCAN8004_BASE_URL = "https://www.8004scan.io/api/v1";

export const scan8004Api = {
  getAgents: (params: {
    sort_by?: string;
    sort_order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    is_testnet?: boolean;
    is_registered?: boolean;
  }) => {
    return fetchREST(`${SCAN8004_BASE_URL}/agents`, {
      sort_by: "created_at",
      sort_order: "desc",
      limit: 10,
      offset: 0,
      is_testnet: false,
      is_registered: true,
      ...params,
    });
  },
  getDomainStats: (is_testnet: boolean = false) => {
    return fetchREST(`${SCAN8004_BASE_URL}/stats/oasf/domains`, { is_testnet });
  },
  getSkillStats: (is_testnet: boolean = false) => {
    return fetchREST(`${SCAN8004_BASE_URL}/stats/oasf/skills`, { is_testnet });
  },
  getLatestAgents: (limit: number = 1, is_testnet: boolean = false) => {
    return fetchREST(`${SCAN8004_BASE_URL}/agents/latest`, { limit, is_testnet });
  },
  getGlobalStats: (is_testnet: boolean = false) => {
    return fetchREST(`${SCAN8004_BASE_URL}/stats/global`, { is_testnet });
  },
  getLeaderboard: (params: {
    period?: "all" | "daily" | "weekly";
    limit?: number;
    offset?: number;
    is_testnet?: boolean;
    group_cross_chain?: boolean;
  }) => {
    return fetchREST(`${SCAN8004_BASE_URL}/agents/leaderboard`, {
      period: "all",
      limit: 20,
      offset: 0,
      is_testnet: false,
      group_cross_chain: true,
      ...params,
    });
  },
};