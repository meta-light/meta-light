import * as fs from 'fs';
import * as path from 'path';

const X402_BASE_URL = 'https://www.x402scan.com/api/trpc';
const SCAN8004_BASE_URL = 'https://www.8004scan.io/api/v1';
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

async function fetchTRPC<T>(
  baseUrl: string,
  endpoint: string,
  input: any,
): Promise<T> {
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set('input', JSON.stringify(input));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`tRPC request failed: ${response.statusText}`);
  }
  return response.json();
}

async function fetchREST<T>(
  url: string,
  params: Record<string, any> = {},
): Promise<T> {
  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(urlObj.toString());
  if (!response.ok) {
    throw new Error(`REST request failed: ${response.statusText}`);
  }
  return response.json();
}

export const x402Api = {
  getAgents: (params: {
    timeframe?: number;
    sorting?: { id: string; desc: boolean };
    pagination?: { page: number; page_size: number };
  }) => {
    return fetchTRPC(X402_BASE_URL, 'public.agents.list', {
      json: {
        timeframe: params.timeframe ?? 1,
        sorting: params.sorting ?? { id: 'score', desc: true },
        pagination: params.pagination ?? { page: 1, page_size: 10 },
      },
    });
  },
  getNetworkStats: (params: {
    numBuckets?: number;
    timeframe?: number;
    chain?: string | null;
  }) => {
    return fetchTRPC(X402_BASE_URL, 'networks.bucketedStatistics', {
      json: {
        numBuckets: params.numBuckets ?? 48,
        timeframe: params.timeframe ?? 0,
        chain: params.chain ?? null,
      },
      meta: { values: { chain: ['undefined'] }, v: 1 },
    });
  },
  getFacilitatorStats: (params: {
    numBuckets?: number;
    timeframe?: number;
    chain?: string | null;
  }) => {
    return fetchTRPC(X402_BASE_URL, 'public.facilitators.bucketedStatistics', {
      json: {
        numBuckets: params.numBuckets ?? 48,
        timeframe: params.timeframe ?? 0,
        chain: params.chain ?? null,
      },
      meta: { values: { chain: ['undefined'] }, v: 1 },
    });
  },
  getOriginDetails: (address: string) => {
    return fetchTRPC(X402_BASE_URL, 'public.origins.list.origins', {
      json: { address },
    });
  },
  getTransfers: (params: {
    chain?: string | null;
    pagination?: { page: number; page_size: number };
    sorting?: { id: string; desc: boolean };
    timeframe?: number;
  }) => {
    return fetchTRPC(X402_BASE_URL, 'public.transfers.list', {
      json: {
        chain: params.chain ?? null,
        pagination: params.pagination ?? { page: 1, page_size: 10 },
        sorting: params.sorting ?? { id: 'block_timestamp', desc: true },
        timeframe: params.timeframe ?? 30,
      },
      meta: { values: { chain: ['undefined'] }, v: 1 },
    });
  },
  getBazaarSellers: (params: {
    timeframe?: number;
    tags?: string[];
    pagination?: { page_size: number };
  }) => {
    return fetchTRPC(X402_BASE_URL, 'public.sellers.bazaar.list', {
      json: {
        timeframe: params.timeframe ?? 0,
        tags: params.tags,
        pagination: params.pagination ?? { page_size: 20 },
      },
    });
  },
  getSellerStats: (
    type: 'all' | 'bazaar',
    metric: 'overall' | 'bucketed',
    timeframe: number = 0,
  ) => {
    const endpoint = `public.sellers.${type}.stats.${metric}`;
    return fetchTRPC(X402_BASE_URL, endpoint, { json: { timeframe } });
  },
};

export const scan8004Api = {
  getAgents: (params: {
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    is_testnet?: boolean;
    is_registered?: boolean;
  }) => {
    return fetchREST(`${SCAN8004_BASE_URL}/agents`, {
      sort_by: 'created_at',
      sort_order: 'desc',
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
    return fetchREST(`${SCAN8004_BASE_URL}/agents/latest`, {
      limit,
      is_testnet,
    });
  },
  getGlobalStats: (is_testnet: boolean = false) => {
    return fetchREST(`${SCAN8004_BASE_URL}/stats/global`, { is_testnet });
  },
  getLeaderboard: (params: {
    period?: 'all' | 'daily' | 'weekly';
    limit?: number;
    offset?: number;
    is_testnet?: boolean;
    group_cross_chain?: boolean;
  }) => {
    return fetchREST(`${SCAN8004_BASE_URL}/agents/leaderboard`, {
      period: 'all',
      limit: 20,
      offset: 0,
      is_testnet: false,
      group_cross_chain: true,
      ...params,
    });
  },
};

export async function fetchFullX402Agents() {
  const filePath = path.join(DATA_DIR, 'x402_agents.json');
  let allAgents: any[] = [];
  if (fs.existsSync(filePath)) {
    console.log('Detected existing x402 agents data. Resuming...');
    try {
      allAgents = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`Resuming from ${allAgents.length} agents.`);
    } catch (e) {}
  }
  console.log('Fetching full x402 agents history...');
  const PAGE_SIZE = 100;
  let page = Math.floor(allAgents.length / PAGE_SIZE) + 1;
  let hasNext = true;
  while (hasNext) {
    try {
      const res: any = await fetchWithRetry(() =>
        x402Api.getAgents({
          pagination: { page, page_size: PAGE_SIZE },
          sorting: { id: 'score', desc: true },
        }),
      );
      const data = res.result.data.json;
      const items = data.items || [];
      if (items.length === 0) break;
      allAgents.push(...items);
      hasNext = data.hasNextPage;
      process.stdout.write(`\rTotal x402 agents: ${allAgents.length}`);
      fs.writeFileSync(filePath, JSON.stringify(allAgents, null, 2));
      page++;
    } catch (error: any) {
      console.error(
        `\nError fetching x402 agents page ${page}:`,
        error.message,
      );
      break;
    }
  }
  console.log('\nx402 agents fetch complete.');
}

export async function fetchFull8004Agents() {
  const filePath = path.join(DATA_DIR, 'scan8004_agents.json');
  let allAgents: any[] = [];
  if (fs.existsSync(filePath)) {
    console.log('Detected existing 8004 scan agents data. Resuming...');
    try {
      allAgents = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`Resuming from ${allAgents.length} agents.`);
    } catch (e) {}
  }
  console.log(
    'Fetching full 8004 scan agents history with parallel batching...',
  );
  const LIMIT = 100;
  const BATCH_SIZE = 3;
  let currentOffset = allAgents.length;
  let hasMore = true;
  while (hasMore) {
    try {
      const batchOffsets = Array.from(
        { length: BATCH_SIZE },
        (_, i) => currentOffset + i * LIMIT,
      );
      console.log(`\nFetching 8004 scan offsets: ${batchOffsets.join(', ')}`);
      const batchPromises = batchOffsets.map((offset) =>
        fetchWithRetry(() =>
          scan8004Api.getAgents({
            offset,
            limit: LIMIT,
            sort_by: 'created_at',
            sort_order: 'desc',
          }),
        )
          .then((items) => ({ offset, items, error: null }))
          .catch((err) => ({ offset, items: [], error: err })),
      );
      const results = await Promise.all(batchPromises);
      results.sort((a, b) => a.offset - b.offset);
      for (const result of results) {
        if (result.error) {
          console.error(
            `\nFailed to fetch 8004 agents at offset ${result.offset}. Stopping.`,
          );
          hasMore = false;
          break;
        }
        const rawRes: any = result.items;
        const items = Array.isArray(rawRes)
          ? rawRes
          : rawRes.agents || rawRes.items || [];
        if (items.length === 0) {
          hasMore = false;
          break;
        }
        allAgents.push(...items);
        currentOffset += items.length;
        if (items.length < LIMIT) {
          hasMore = false;
          break;
        }
      }
      process.stdout.write(`\rTotal 8004 agents: ${allAgents.length}`);
      fs.writeFileSync(filePath, JSON.stringify(allAgents, null, 2));
      if (!hasMore) break;
      await new Promise((res) => setTimeout(res, 2000));
    } catch (error: any) {
      console.error(`\nUnexpected error in 8004 agents fetch:`, error.message);
      break;
    }
  }
  console.log('\n8004 scan agents fetch complete.');
}

export async function fetchAllX402() {
  console.log('Fetching x402 data...');
  let allAgents: any[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const res: any = await x402Api.getAgents({
      pagination: { page, page_size: 100 },
    });
    const data = res.result.data.json;
    allAgents.push(...data.items);
    hasNext = data.hasNextPage;
    page++;
    if (page > 10) break;
  }
  await saveJson('x402_agents.json', allAgents);
  const networkStats = await x402Api.getNetworkStats({});
  await saveJson('x402_network_stats.json', networkStats);
  const facilitatorStats = await x402Api.getFacilitatorStats({});
  await saveJson('x402_facilitator_stats.json', facilitatorStats);
  let allTransfers: any[] = [];
  page = 1;
  hasNext = true;
  while (hasNext) {
    const res: any = await x402Api.getTransfers({
      timeframe: 0,
      pagination: { page, page_size: 100 },
    });
    const data = res.result.data.json;
    allTransfers.push(...data.items);
    hasNext = data.hasNextPage;
    page++;
    if (page > 1000) break;
  }
  await saveJson('x402_transfers.json', allTransfers);
  const tags = ['Search', 'Crypto', 'Utility', 'Trading'];
  for (const tag of tags) {
    const sellers = await x402Api.getBazaarSellers({
      tags: [tag],
      pagination: { page_size: 100 },
    });
    await saveJson(`x402_bazaar_sellers_${tag.toLowerCase()}.json`, sellers);
  }
  const sellerStatsOverall = await x402Api.getSellerStats('all', 'overall');
  await saveJson('x402_seller_stats_overall.json', sellerStatsOverall);
}

export async function fetchAll8004Scan() {
  console.log('Fetching 8004scan data...');
  let allAgents: any[] = [];
  let offset = 0;
  let limit = 100;
  while (true) {
    const res: any = await scan8004Api.getAgents({ offset, limit });
    const items = Array.isArray(res) ? res : res.agents || res.items || [];
    if (items.length === 0) break;
    allAgents.push(...items);
    offset += limit;
    if (offset > 1000) break;
  }
  await saveJson('scan8004_agents.json', allAgents);
  await saveJson('scan8004_domains.json', await scan8004Api.getDomainStats());
  await saveJson('scan8004_skills.json', await scan8004Api.getSkillStats());
  await saveJson('scan8004_global.json', await scan8004Api.getGlobalStats());
  const leaderboard = await scan8004Api.getLeaderboard({ limit: 100 });
  await saveJson('scan8004_leaderboard.json', leaderboard);
}

async function fetchX402Stats() {
  console.log('Fetching x402 stats...');
  const networkStats = await x402Api.getNetworkStats({ numBuckets: 1000 });
  await saveJson('x402_network_stats.json', networkStats);
  const facilitatorStats = await x402Api.getFacilitatorStats({
    numBuckets: 1000,
  });
  await saveJson('x402_facilitator_stats.json', facilitatorStats);
}

async function fetch8004Stats() {
  console.log('Fetching 8004scan stats...');
  try {
    const global = await fetchWithRetry(() => scan8004Api.getGlobalStats());
    await saveJson('scan8004_global.json', global);
    const domains = await fetchWithRetry(() => scan8004Api.getDomainStats());
    await saveJson('scan8004_domains.json', domains);
    const skills = await fetchWithRetry(() => scan8004Api.getSkillStats());
    await saveJson('scan8004_skills.json', skills);
    const leaderboard = await fetchWithRetry(() =>
      scan8004Api.getLeaderboard({ limit: 100 }),
    );
    await saveJson('scan8004_leaderboard.json', leaderboard);
  } catch (e) {
    console.error('Error fetching 8004 stats:', e);
  }
}

async function saveJson(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filename} ($data.length} items)`);
}

async function fetchWithRetry(
  fn: () => Promise<any>,
  retries = 3,
  delay = 1000,
): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      console.log(
        `\nRetrying... (${retries} attempts left) due to: ${error.message}`,
      );
      await new Promise((res) => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function fetchFullTransfers() {
  const filePath = path.join(DATA_DIR, 'x402_transfers.json');
  let allTransfers: any[] = [];
  if (fs.existsSync(filePath)) {
    console.log('Detected existing data. Loading to resume...');
    try {
      const existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(existingData)) {
        allTransfers = existingData;
        console.log(`Resuming from ${allTransfers.length} items.`);
      }
    } catch (e) {
      console.error('Failed to parse existing JSON, starting fresh.');
    }
  }
  console.log(
    'Fetching full transfer history from x402 with parallel batching, retries, and resume...',
  );
  const PAGE_SIZE = 200;
  const BATCH_SIZE = 5;
  let startPage = Math.floor(allTransfers.length / PAGE_SIZE) + 1;
  let hasMore = true;
  while (hasMore) {
    try {
      console.log(
        `\nFetching pages ${startPage} to ${startPage + BATCH_SIZE - 1} (Page Size: ${PAGE_SIZE})...`,
      );
      const batchPromises = Array.from({ length: BATCH_SIZE }, (_, i) => {
        const page = startPage + i;
        return fetchWithRetry(() =>
          x402Api.getTransfers({
            timeframe: 0,
            pagination: { page, page_size: PAGE_SIZE },
          }),
        )
          .then((res) => ({ page, res, error: null }))
          .catch((err) => ({ page, res: null, error: err }));
      });
      const batchResults = await Promise.all(batchPromises);
      batchResults.sort((a, b) => a.page - b.page);
      let batchItemsAdded = 0;
      for (const { res, error, page } of batchResults) {
        if (error) {
          console.error(
            `\nFailed to fetch page ${page} after retries. Stopping batch processing.`,
          );
          hasMore = false;
          break;
        }
        const data = (res as any).result.data.json;
        const items = data.items || [];
        if (items.length > 0) {
          allTransfers.push(...items);
          batchItemsAdded += items.length;
        }
        if (!data.hasNextPage || items.length < PAGE_SIZE) {
          hasMore = false;
          break;
        }
      }
      if (allTransfers.length > 0) {
        const oldest = allTransfers[allTransfers.length - 1].block_timestamp;
        process.stdout.write(
          `\rTotal items: ${allTransfers.length} | Latency check (oldest): ${new Date(oldest).toISOString().split('T')[0]}`,
        );
      }
      if (batchItemsAdded > 0) {
        fs.writeFileSync(filePath, JSON.stringify(allTransfers, null, 2));
      }
      if (!hasMore) break;
      startPage += BATCH_SIZE;
      await new Promise((res) => setTimeout(res, 500));
    } catch (error: any) {
      console.error(
        `\nUnexpected error in batch starting at page ${startPage}:`,
        error.message,
      );
      break;
    }
  }
  console.log(`\nFetch complete. Total items: ${allTransfers.length}`);
}

function toDateStr(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function getNextDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

export async function generateMasterTimeseries() {
  console.log('Generating master timeseries...');
  const masterMap: Record<string, any> = {};
  const netPath = path.join(DATA_DIR, 'x402_network_stats.json');
  if (fs.existsSync(netPath)) {
    const data = JSON.parse(fs.readFileSync(netPath, 'utf-8'));
    const items = data.result?.data?.json || [];
    for (const item of items) {
      const date = toDateStr(item.bucket_start);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      let txs = 0;
      let vol = 0;
      for (const s of Object.values(item.networks || {})) {
        const net = s as any;
        txs += net.total_transactions || 0;
        vol += net.total_amount || 0;
      }
      masterMap[date]['x402_network_daily_txs'] = txs;
      masterMap[date]['x402_network_daily_volume'] = vol;
    }
  }
  
  const facPath = path.join(DATA_DIR, 'x402_facilitator_stats.json');
  if (fs.existsSync(facPath)) {
    const data = JSON.parse(fs.readFileSync(facPath, 'utf-8'));
    const items = data.result?.data?.json || [];
    for (const item of items) {
      const date = toDateStr(item.bucket_start);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      let txs = 0;
      let vol = 0;
      for (const s of Object.values(item.facilitators || {})) {
        const fac = s as any;
        txs += fac.total_transactions || 0;
        vol += fac.total_amount || 0;
      }
      masterMap[date]['x402_facilitator_daily_txs'] = txs;
      masterMap[date]['x402_facilitator_daily_volume'] = vol;
    }
  }

  const xXPath = path.join(DATA_DIR, 'x402_agents.json');
  if (fs.existsSync(xXPath)) {
    const data = JSON.parse(fs.readFileSync(xXPath, 'utf-8'));
    for (const a of data) {
      if (!a.createdAt) continue;
      const date = toDateStr(a.createdAt);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      masterMap[date]['x402_agents_new'] =
        (masterMap[date]['x402_agents_new'] || 0) + 1;
    }
  }

  const sXPath = path.join(DATA_DIR, 'scan8004_agents.json');
  if (fs.existsSync(sXPath)) {
    const data = JSON.parse(fs.readFileSync(sXPath, 'utf-8'));
    for (const a of data) {
      const ts = a.created_at || a.createdAt;
      if (!ts) continue;
      const date = toDateStr(ts);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      masterMap[date]['scan8004_agents_new'] =
        (masterMap[date]['scan8004_agents_new'] || 0) + 1;
    }
  }

  const externalFiles = [
    { name: 'ERC-8004_Daily_Agent_Registrations.csv', dateCol: 'block_date' },
    {
      name: 'ERC-8004_Trustless_Agents_Register_Event.csv',
      dateCol: 'block_date',
    },
    { name: 'erc8004-adoption-trend.csv', dateCol: 'day' },
  ];

  for (const ext of externalFiles) {
    const p = path.join(__dirname, ext.name);
    if (fs.existsSync(p)) {
      console.log(`Processing ${ext.name}...`);
      const content = fs.readFileSync(p, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());
      const headers = lines[0].split(',');
      const dateIdx = headers.indexOf(ext.dateCol);
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const rawDate = parts[dateIdx];
        if (!rawDate) continue;
        const date = toDateStr(rawDate.split(' ')[0]);
        if (!date) continue;
        if (!masterMap[date]) masterMap[date] = {};
        headers.forEach((h, idx) => {
          if (idx === dateIdx) return;
          const val = Number(parts[idx]) || 0;
          if (ext.name === 'ERC-8004_Daily_Agent_Registrations.csv') {
            if (h === 'daily_registrations')
              masterMap[date]['ext_daily_registrations_total'] = val;
            if (h === 'cumulative_agents')
              masterMap[date]['ext_daily_registrations_cumulative'] = val;
          } else if (
            ext.name === 'ERC-8004_Trustless_Agents_Register_Event.csv'
          ) {
            if (h === 'registered') {
              masterMap[date]['ext_trustless_event_registrations_total'] =
                (masterMap[date]['ext_trustless_event_registrations_total'] ||
                  0) + val;
            }
          } else if (ext.name === 'erc8004-adoption-trend.csv') {
            masterMap[date]['ext_adoption_trend_cumulative_total'] =
              (masterMap[date]['ext_adoption_trend_cumulative_total'] || 0) +
              val;
          }
        });
      }
    }
  }

  const dates = Object.keys(masterMap).sort();
  if (dates.length === 0) {
    console.error('No data found to process.');
    return;
  }
  const startDate = dates[0];
  const endDate = toDateStr(new Date());
  console.log(`Filling gaps from ${startDate} to ${endDate}...`);
  const allColumns = new Set<string>();
  Object.values(masterMap).forEach((day) => {
    Object.keys(day).forEach((k) => allColumns.add(k));
  });
  const sortedColumns = Array.from(allColumns).sort();
  const resultRows: any[] = [];
  let currentDate = startDate;
  let x402AgentsCum = 0;
  let scan8004AgentsCum = 0;

  while (currentDate <= endDate) {
    const dayData = masterMap[currentDate] || {};

    x402AgentsCum += dayData['x402_agents_new'] || 0;
    scan8004AgentsCum += dayData['scan8004_agents_new'] || 0;

    const row: any = {
      Date: currentDate,
      x402_agents_cumulative: x402AgentsCum,
      scan8004_agents_cumulative: scan8004AgentsCum,
    };

    sortedColumns.forEach((col) => {
      row[col] = dayData[col] || 0;
    });

    resultRows.push(row);
    currentDate = getNextDate(currentDate);
  }

  const csvHeaders = [
    'Date',
    'x402_agents_cumulative',
    'scan8004_agents_cumulative',
    ...sortedColumns,
  ];
  const csvContent = [
    csvHeaders.join(','),
    ...resultRows.map((row) => csvHeaders.map((h) => row[h]).join(',')),
  ].join('\n');

  fs.writeFileSync(path.join(DATA_DIR, 'master_timeseries.csv'), csvContent);
  console.log(`Saved master_timeseries.csv (${resultRows.length} rows)`);
}