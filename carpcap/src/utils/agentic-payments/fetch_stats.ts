
import { x402Api, scan8004Api } from './api';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR); }

async function saveJson(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filename}`);
}

async function fetchWithRetry(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      console.log(`\nRetrying... (${retries} attempts left) due to: ${error.message}`);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function fetchX402Stats() {
  console.log('Fetching x402 stats...');
  // Increased numBuckets to ensure we get everything (e.g., 2 years)
  const networkStats = await x402Api.getNetworkStats({ numBuckets: 1000 });
  await saveJson('x402_network_stats.json', networkStats);

  const facilitatorStats = await x402Api.getFacilitatorStats({ numBuckets: 1000 });
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

    const leaderboard = await fetchWithRetry(() => scan8004Api.getLeaderboard({ limit: 1000 }));
    await saveJson('scan8004_leaderboard.json', leaderboard);
  } catch (e) {
    console.error('Error fetching 8004 stats:', e);
  }
}

async function main() {
  await fetchX402Stats();
  await fetch8004Stats();
  // Note: Agents are handled by fetch_agents.ts for "full" history
  // Transfers are handled by fetch_transfers.ts
  console.log('Stats fetching complete!');
}

main().catch(console.error);
