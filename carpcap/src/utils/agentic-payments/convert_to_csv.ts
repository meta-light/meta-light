
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');

function toDateStr(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toISOString().split('T')[0];
}

function writeCsv(filename: string, headers: string[], rows: any[][]) {
  const filePath = path.join(DATA_DIR, filename);
  const content = [
    headers.join(','),
    ...rows.map(row => row.map(val => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(','))
  ].join('\n');
  fs.writeFileSync(filePath, content);
  console.log(`Saved ${filename}`);
}

async function convertStats() {
  console.log('Converting stats and transfers...');
  
  const statsMap: Record<string, any> = {};

  // 1. Facilitator Stats (Aggregate)
  const facPath = path.join(DATA_DIR, 'x402_facilitator_stats.json');
  if (fs.existsSync(facPath)) {
    const facData = JSON.parse(fs.readFileSync(facPath, 'utf-8'));
    const items = facData.result?.data?.json || [];
    for (const item of items) {
      const date = toDateStr(item.bucket_start);
      if (!statsMap[date]) statsMap[date] = { date };
      
      let dayTxs = 0;
      let dayAmt = 0;
      for (const stats of Object.values(item.facilitators || {})) {
        const s = stats as any;
        dayTxs += s.total_transactions || 0;
        dayAmt += s.total_amount || 0;
      }
      statsMap[date][`x402_total_txs_by_facilitator`] = dayTxs;
      statsMap[date][`x402_total_volume_by_facilitator`] = dayAmt;
    }
  }

  // 2. Network Stats (Aggregate)
  const netPath = path.join(DATA_DIR, 'x402_network_stats.json');
  if (fs.existsSync(netPath)) {
    const netData = JSON.parse(fs.readFileSync(netPath, 'utf-8'));
    const items = netData.result?.data?.json || [];
    for (const item of items) {
      const date = toDateStr(item.bucket_start);
      if (!statsMap[date]) statsMap[date] = { date };
      
      let dayTxs = 0;
      let dayAmt = 0;
      for (const stats of Object.values(item.networks || {})) {
        const s = stats as any;
        dayTxs += s.total_transactions || 0;
        dayAmt += s.total_amount || 0;
      }
      statsMap[date][`x402_total_txs_by_network`] = dayTxs;
      statsMap[date][`x402_total_volume_by_network`] = dayAmt;
    }
  }

  // 3. Transfers (Aggregate by Date from raw data)
  const transPath = path.join(DATA_DIR, 'x402_transfers.json');
  if (fs.existsSync(transPath)) {
    const transData = JSON.parse(fs.readFileSync(transPath, 'utf-8'));
    for (const tx of transData) {
      const date = toDateStr(tx.block_timestamp);
      if (!statsMap[date]) statsMap[date] = { date };
      
      statsMap[date].x402_raw_transfer_count = (statsMap[date].x402_raw_transfer_count || 0) + 1;
      statsMap[date].x402_raw_transfer_volume = (statsMap[date].x402_raw_transfer_volume || 0) + Number(tx.amount || 0);
    }
  }

  // Add Agent registrations for comparison
  const xXPath = path.join(DATA_DIR, 'x402_agents.json');
  if (fs.existsSync(xXPath)) {
    const data = JSON.parse(fs.readFileSync(xXPath, 'utf-8'));
    for (const a of data) {
      if (!a.createdAt) continue;
      const date = toDateStr(a.createdAt);
      if (!statsMap[date]) statsMap[date] = { date };
      statsMap[date].x402_agents_added = (statsMap[date].x402_agents_added || 0) + 1;
    }
  }

  const sXPath = path.join(DATA_DIR, 'scan8004_agents.json');
  if (fs.existsSync(sXPath)) {
    const data = JSON.parse(fs.readFileSync(sXPath, 'utf-8'));
    for (const a of data) {
      if (!a.created_at) continue;
      const date = toDateStr(a.created_at);
      if (!statsMap[date]) statsMap[date] = { date };
      statsMap[date].scan8004_agents_added = (statsMap[date].scan8004_agents_added || 0) + 1;
    }
  }

  // Merge and sort
  const allDates = Object.keys(statsMap).sort();
  if (allDates.length === 0) return;

  const allHeadersSet = new Set<string>();
  for (const date of allDates) {
    for (const key of Object.keys(statsMap[date])) {
      if (key !== 'date') allHeadersSet.add(key);
    }
  }
  const sortedHeaders = ['date', ...Array.from(allHeadersSet).sort()];

  const rows = allDates.map(date => {
    return sortedHeaders.map(h => statsMap[date][h] ?? 0);
  });

  writeCsv('combined_stats.csv', sortedHeaders, rows);
}

async function main() {
  await convertStats();
  console.log('Conversion complete!');
}

main().catch(console.error);
