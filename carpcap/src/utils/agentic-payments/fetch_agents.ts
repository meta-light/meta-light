
import { x402Api, scan8004Api } from './api';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

async function fetchWithRetry(fn: () => Promise<any>, retries = 5, delay = 1000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.message.includes('Too Many Requests') || error.message.includes('429')) {
      const waitTime = delay * 5; // Wait longer for rate limits
      console.log(`\nRate limited. Waiting ${waitTime}ms before retry...`);
      await new Promise(res => setTimeout(res, waitTime));
      return fetchWithRetry(fn, retries - 1, delay);
    }
    if (retries > 0) {
      console.log(`\nRetrying... (${retries} attempts left) due to: ${error.message}`);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function fetchFullX402Agents() {
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
      const res: any = await fetchWithRetry(() => x402Api.getAgents({ 
        pagination: { page, page_size: PAGE_SIZE },
        sorting: { id: "score", desc: true }
      }));
      
      const data = res.result.data.json;
      const items = data.items || [];
      
      if (items.length === 0) break;
      
      allAgents.push(...items);
      hasNext = data.hasNextPage;
      
      process.stdout.write(`\rTotal x402 agents: ${allAgents.length}`);
      
      fs.writeFileSync(filePath, JSON.stringify(allAgents, null, 2));
      
      page++;
    } catch (error: any) {
      console.error(`\nError fetching x402 agents page ${page}:`, error.message);
      break;
    }
  }
  console.log('\nx402 agents fetch complete.');
}

async function fetchFull8004Agents() {
  const filePath = path.join(DATA_DIR, 'scan8004_agents.json');
  let allAgents: any[] = [];
  
  if (fs.existsSync(filePath)) {
    console.log('Detected existing 8004 scan agents data. Resuming...');
    try {
      allAgents = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`Resuming from ${allAgents.length} agents.`);
    } catch (e) {}
  }

  console.log('Fetching full 8004 scan agents history with parallel batching...');
  const LIMIT = 100;
  const BATCH_SIZE = 3; // Keep it small to avoid aggressive rate limiting
  let currentOffset = allAgents.length;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const batchOffsets = Array.from({ length: BATCH_SIZE }, (_, i) => currentOffset + (i * LIMIT));
      console.log(`\nFetching 8004 scan offsets: ${batchOffsets.join(', ')}`);
      
      const batchPromises = batchOffsets.map(offset => 
        fetchWithRetry(() => scan8004Api.getAgents({ 
          offset, 
          limit: LIMIT,
          sort_by: "created_at",
          sort_order: "desc"
        })).then(items => ({ offset, items, error: null }))
           .catch(err => ({ offset, items: [], error: err }))
      );
      
      const results = await Promise.all(batchPromises);
      results.sort((a, b) => a.offset - b.offset);
      
      for (const result of results) {
        if (result.error) {
          console.error(`\nFailed to fetch 8004 agents at offset ${result.offset}. Stopping.`);
          hasMore = false;
          break;
        }
        
        const rawRes: any = result.items;
        const items = Array.isArray(rawRes) ? rawRes : (rawRes.agents || rawRes.items || []);
        
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
      
      // Grace period between batches
      await new Promise(res => setTimeout(res, 2000));
      
    } catch (error: any) {
      console.error(`\nUnexpected error in 8004 agents fetch:`, error.message);
      break;
    }
  }
  console.log('\n8004 scan agents fetch complete.');
}

async function main() {
  await fetchFullX402Agents();
  await fetchFull8004Agents();
  console.log('Full agent history fetch complete!');
}

main().catch(console.error);
