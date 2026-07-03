
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');

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

async function generateMasterTimeseries() {
  console.log('Generating master timeseries...');
  
  const masterMap: Record<string, any> = {};

  // 1. Load x402 Network Stats
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

  // 2. Load x402 Facilitator Stats
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

  // 3. Load x402 Agents
  const xXPath = path.join(DATA_DIR, 'x402_agents.json');
  if (fs.existsSync(xXPath)) {
    const data = JSON.parse(fs.readFileSync(xXPath, 'utf-8'));
    for (const a of data) {
      if (!a.createdAt) continue;
      const date = toDateStr(a.createdAt);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      masterMap[date]['x402_agents_new'] = (masterMap[date]['x402_agents_new'] || 0) + 1;
    }
  }

  // 4. Load 8004 Scan Agents
  const sXPath = path.join(DATA_DIR, 'scan8004_agents.json');
  if (fs.existsSync(sXPath)) {
    const data = JSON.parse(fs.readFileSync(sXPath, 'utf-8'));
    for (const a of data) {
      const ts = a.created_at || a.createdAt;
      if (!ts) continue;
      const date = toDateStr(ts);
      if (!date) continue;
      if (!masterMap[date]) masterMap[date] = {};
      masterMap[date]['scan8004_agents_new'] = (masterMap[date]['scan8004_agents_new'] || 0) + 1;
    }
  }

  // 5. Load External CSVs
  const externalFiles = [
    { name: 'ERC-8004_Daily_Agent_Registrations.csv', dateCol: 'block_date' },
    { name: 'ERC-8004_Trustless_Agents_Register_Event.csv', dateCol: 'block_date' },
    { name: 'erc8004-adoption-trend.csv', dateCol: 'day' }
  ];

  for (const ext of externalFiles) {
    const p = path.join(__dirname, ext.name); 
    if (fs.existsSync(p)) {
      console.log(`Processing ${ext.name}...`);
      const content = fs.readFileSync(p, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',');
      const dateIdx = headers.indexOf(ext.dateCol);
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const rawDate = parts[dateIdx];
        if (!rawDate) continue;
        const date = toDateStr(rawDate.split(' ')[0]);
        if (!date) continue;
        
        if (!masterMap[date]) masterMap[date] = {};
        
        let fileTotalDaily = 0;
        let fileTotalCumulative = 0;

        headers.forEach((h, idx) => {
          if (idx === dateIdx) return;
          const val = Number(parts[idx]) || 0;
          
          if (ext.name === 'ERC-8004_Daily_Agent_Registrations.csv') {
            if (h === 'daily_registrations') masterMap[date]['ext_daily_registrations_total'] = val;
            if (h === 'cumulative_agents') masterMap[date]['ext_daily_registrations_cumulative'] = val;
          } else if (ext.name === 'ERC-8004_Trustless_Agents_Register_Event.csv') {
            if (h === 'registered') {
              masterMap[date]['ext_trustless_event_registrations_total'] = (masterMap[date]['ext_trustless_event_registrations_total'] || 0) + val;
            }
          } else if (ext.name === 'erc8004-adoption-trend.csv') {
            // Aggregate all cumulative columns into one
            masterMap[date]['ext_adoption_trend_cumulative_total'] = (masterMap[date]['ext_adoption_trend_cumulative_total'] || 0) + val;
          }
        });
      }
    }
  }

  // Determine date range
  const dates = Object.keys(masterMap).sort();
  if (dates.length === 0) {
    console.error('No data found to process.');
    return;
  }

  const startDate = dates[0];
  const endDate = toDateStr(new Date()); 
  
  console.log(`Filling gaps from ${startDate} to ${endDate}...`);

  const allColumns = new Set<string>();
  Object.values(masterMap).forEach(day => {
    Object.keys(day).forEach(k => allColumns.add(k));
  });
  const sortedColumns = Array.from(allColumns).sort();

  const resultRows: any[] = [];
  let currentDate = startDate;
  
  let x402AgentsCum = 0;
  let scan8004AgentsCum = 0;

  while (currentDate <= endDate) {
    const dayData = masterMap[currentDate] || {};
    
    x402AgentsCum += (dayData['x402_agents_new'] || 0);
    scan8004AgentsCum += (dayData['scan8004_agents_new'] || 0);

    const row: any = {
      Date: currentDate,
      x402_agents_cumulative: x402AgentsCum,
      scan8004_agents_cumulative: scan8004AgentsCum
    };

    sortedColumns.forEach(col => {
      row[col] = dayData[col] || 0;
    });

    resultRows.push(row);
    currentDate = getNextDate(currentDate);
  }

  // Write to CSV
  const csvHeaders = ['Date', 'x402_agents_cumulative', 'scan8004_agents_cumulative', ...sortedColumns];
  const csvContent = [
    csvHeaders.join(','),
    ...resultRows.map(row => csvHeaders.map(h => row[h]).join(','))
  ].join('\n');

  fs.writeFileSync(path.join(DATA_DIR, 'master_timeseries.csv'), csvContent);
  console.log(`Saved master_timeseries.csv (${resultRows.length} rows)`);
}

generateMasterTimeseries().catch(console.error);
