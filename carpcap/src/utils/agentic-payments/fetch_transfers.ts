
import { x402Api } from './api';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

async function saveJson(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved ${filename} ($data.length} items)`);
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

async function fetchFullTransfers() {
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

  console.log('Fetching full transfer history from x402 with parallel batching, retries, and resume...');
  
  const PAGE_SIZE = 200; // Reduced from 1000 to avoid 500 errors on deep pages
  const BATCH_SIZE = 5;
  let startPage = Math.floor(allTransfers.length / PAGE_SIZE) + 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      console.log(`\nFetching pages ${startPage} to ${startPage + BATCH_SIZE - 1} (Page Size: ${PAGE_SIZE})...`);
      
      const batchPromises = Array.from({ length: BATCH_SIZE }, (_, i) => {
        const page = startPage + i;
        return fetchWithRetry(() => x402Api.getTransfers({ 
          timeframe: 0, 
          pagination: { page, page_size: PAGE_SIZE } 
        })).then(res => ({ page, res, error: null }))
           .catch(err => ({ page, res: null, error: err }));
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Sort results by page to ensure order
      batchResults.sort((a, b) => a.page - b.page);
      
      let batchItemsAdded = 0;
      for (const { res, error, page } of batchResults) {
        if (error) {
          console.error(`\nFailed to fetch page ${page} after retries. Stopping batch processing.`);
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
        process.stdout.write(`\rTotal items: ${allTransfers.length} | Latency check (oldest): ${new Date(oldest).toISOString().split('T')[0]}`);
      }

      // Save progress after every batch to allow resuming
      if (batchItemsAdded > 0) {
        fs.writeFileSync(filePath, JSON.stringify(allTransfers, null, 2));
      }
      
      if (!hasMore) break;
      startPage += BATCH_SIZE;
      
      // Small delay between batches
      await new Promise(res => setTimeout(res, 500));
      
    } catch (error: any) {
      console.error(`\nUnexpected error in batch starting at page ${startPage}:`, error.message);
      break;
    }
  }
  
  console.log(`\nFetch complete. Total items: ${allTransfers.length}`);
}

fetchFullTransfers().catch(console.error);
