
import { x402Api, scan8004Api } from './api';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR);}

async function saveJson(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filename}`);
}

async function fetchAllX402() {
  console.log('Fetching x402 data...');
  let allAgents: any[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const res: any = await x402Api.getAgents({ pagination: { page, page_size: 100 } });
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
    const res: any = await x402Api.getTransfers({ timeframe: 0, pagination: { page, page_size: 100 } });
    const data = res.result.data.json;
    allTransfers.push(...data.items);
    hasNext = data.hasNextPage;
    page++;
    if (page > 1000) break; 
  }
  await saveJson('x402_transfers.json', allTransfers);

  // 5. Bazaar Sellers (Tags)
  const tags = ["Search", "Crypto", "Utility", "Trading"];
  for (const tag of tags) {
    const sellers = await x402Api.getBazaarSellers({ tags: [tag], pagination: { page_size: 100 } });
    await saveJson(`x402_bazaar_sellers_${tag.toLowerCase()}.json`, sellers);
  }

  // 6. Seller Stats
  const sellerStatsOverall = await x402Api.getSellerStats('all', 'overall');
  await saveJson('x402_seller_stats_overall.json', sellerStatsOverall);
}

async function fetchAll8004Scan() {
  console.log('Fetching 8004scan data...');

  // 1. Agents (Paginated)
  let allAgents: any[] = [];
  let offset = 0;
  let limit = 100;
  while (true) {
    const res: any = await scan8004Api.getAgents({ offset, limit });
    // Assuming 8004 returns an array directly or { agents: [] }
    const items = Array.isArray(res) ? res : (res.agents || res.items || []);
    if (items.length === 0) break;
    allAgents.push(...items);
    offset += limit;
    if (offset > 1000) break; // Safety cap
  }
  await saveJson('scan8004_agents.json', allAgents);

  // 2. Stats
  await saveJson('scan8004_domains.json', await scan8004Api.getDomainStats());
  await saveJson('scan8004_skills.json', await scan8004Api.getSkillStats());
  await saveJson('scan8004_global.json', await scan8004Api.getGlobalStats());

  // 3. Leaderboard
  const leaderboard = await scan8004Api.getLeaderboard({ limit: 100 });
  await saveJson('scan8004_leaderboard.json', leaderboard);
}

async function main() {
  try {
    await fetchAllX402();
    await fetchAll8004Scan();
    console.log('All data fetched successfully!');
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

main();
