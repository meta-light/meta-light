#!/usr/bin/env tsx

import puppeteer from 'puppeteer';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync } from 'fs';

// puppeteer.use(StealthPlugin());

interface ApiCall {
  method: string;
  url: string;
  status?: number;
  contentType?: string;
  timestamp: Date;
  responseSize?: number;
  isApi: boolean;
  isWebSocket: boolean;
  isData: boolean;
}

interface DiscoveryResult {
  url: string;
  apis: ApiCall[];
  webSockets: string[];
  dataEndpoints: string[];
  summary: {
    totalRequests: number;
    apiCalls: number;
    webSocketConnections: number;
    dataEndpoints: number;
    uniqueDomains: string[];
  };
}

async function discoverApis(targetUrl: string): Promise<DiscoveryResult> {
  console.log(`Starting API discovery for: ${targetUrl}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  const page = await browser.newPage();
  const apis: ApiCall[] = [];
  const webSockets: string[] = [];
  const dataEndpoints: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const isApi = url.includes('/api/') || 
                  url.includes('/v1/') || 
                  url.includes('/v2/') || 
                  url.includes('/graphql') ||
                  url.includes('/rest/') ||
                  url.includes('/data/') ||
                  url.includes('/json') ||
                  url.includes('/xml') ||
                  method !== 'GET';
    const isWebSocket = url.startsWith('ws://') || url.startsWith('wss://');
    const isData = url.includes('/data') || 
                   url.includes('/feed') || 
                   url.includes('/news') ||
                   url.includes('/posts') ||
                   url.includes('/articles') ||
                   url.includes('/content');
    if (isApi || isWebSocket || isData) {
      const apiCall: ApiCall = {method, url, timestamp: new Date(), isApi, isWebSocket, isData};
      apis.push(apiCall);
      if (isWebSocket) {webSockets.push(url);}
      if (isData) {dataEndpoints.push(url);}
      console.log(`${method} ${url} ${isApi ? '[API]' : ''} ${isWebSocket ? '[WS]' : ''} ${isData ? '[DATA]' : ''}`);
    }
  });
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';
    const apiCall = apis.find(api => api.url === url);
    if (apiCall) {
      apiCall.status = status;
      apiCall.contentType = contentType;
      if (status === 200 && (contentType.includes('json') || contentType.includes('xml'))) {
        try {
          const responseText = await response.text();
          apiCall.responseSize = responseText.length;
          if (responseText.length > 100 && responseText.length < 10000) {
            console.log(`Response preview for ${url}:`);
            console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
          }
        } 
        catch (error) {}
      }
    }
  });
//   page.on('websocket', (ws) => {
//     const url = ws.url();
//     console.log(`🔌 WebSocket connected: ${url}`);
//     if (!webSockets.includes(url)) {
//       webSockets.push(url);
//     }
//   });
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('api') || text.includes('fetch') || text.includes('axios') || text.includes('request')) {console.log(`Console: ${text}`);}
  });
  try {
    console.log('🚀 Navigating to page...');
    await page.goto(targetUrl, {waitUntil: 'networkidle2', timeout: 60000});
    console.log('⏳ Waiting for additional API calls...');
    // await page.waitForTimeout(5000);
    console.log('🔄 Scrolling to trigger lazy loading...');
    await page.evaluate(() => {window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0);});
    // await page.waitForTimeout(3000);
    console.log('🔍 Analyzing page source for API patterns...');
    const pageSource = await page.content();
    const apiPatterns = [
      /https?:\/\/[^"'\s]+\/api\/[^"'\s]+/g,
      /https?:\/\/[^"'\s]+\/v\d+\/[^"'\s]+/g,
      /https?:\/\/[^"'\s]+\/graphql/g,
      /https?:\/\/[^"'\s]+\/rest\/[^"'\s]+/g,
      /https?:\/\/[^"'\s]+\/data\/[^"'\s]+/g,
      /wss?:\/\/[^"'\s]+/g
    ];
    apiPatterns.forEach(pattern => {
      const matches = pageSource.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!apis.some(api => api.url === match)) {
            const apiCall: ApiCall = {
              method: 'GET',
              url: match,
              timestamp: new Date(),
              isApi: match.includes('/api/') || match.includes('/v') || match.includes('/graphql') || match.includes('/rest/'),
              isWebSocket: match.startsWith('ws'),
              isData: match.includes('/data/')
            };
            apis.push(apiCall);
            console.log(`🔍 Found API in source: ${match}`);
          }
        });
      }
    });

  } 
  catch (error) {console.error('Error during discovery:', error);} 
  finally {await browser.close();}
  const uniqueDomains = [...new Set(apis.map(api => new URL(api.url).hostname))];
  const result: DiscoveryResult = {
    url: targetUrl,
    apis: apis.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    webSockets: [...new Set(webSockets)],
    dataEndpoints: [...new Set(dataEndpoints)],
    summary: {
      totalRequests: apis.length,
      apiCalls: apis.filter(api => api.isApi).length,
      webSocketConnections: webSockets.length,
      dataEndpoints: dataEndpoints.length,
      uniqueDomains
    }
  };
  return result;
}

function printResults(result: DiscoveryResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('API DISCOVERY RESULTS');
  console.log('='.repeat(80));
  console.log(`Target URL: ${result.url}`);
  console.log(`Total Requests: ${result.summary.totalRequests}`);
  console.log(`API Calls: ${result.summary.apiCalls}`);
  console.log(`WebSocket Connections: ${result.summary.webSocketConnections}`);
  console.log(`Data Endpoints: ${result.summary.dataEndpoints}`);
  console.log(`Unique Domains: ${result.summary.uniqueDomains.length}`);
  if (result.summary.uniqueDomains.length > 0) {
    console.log('\nDomains:');
    result.summary.uniqueDomains.forEach(domain => console.log(`   - ${domain}`));
  }
  if (result.apis.length > 0) {
    console.log('\n📡 All Discovered Endpoints:');
    result.apis.forEach((api, index) => {
      const status = api.status ? ` [${api.status}]` : '';
      const size = api.responseSize ? ` (${api.responseSize} chars)` : '';
      const type = api.contentType ? ` [${api.contentType.split(';')[0]}]` : '';
      console.log(`   ${index + 1}. ${api.method} ${api.url}${status}${type}${size}`);
    });
  }
  if (result.webSockets.length > 0) {console.log('\n🔌 WebSocket Endpoints:'); result.webSockets.forEach(ws => console.log(`   - ${ws}`));}
  if (result.dataEndpoints.length > 0) {console.log('\nData Endpoints:'); result.dataEndpoints.forEach(endpoint => console.log(`   - ${endpoint}`));}
  const promisingApis = result.apis.filter(api => api.status === 200 && (api.contentType?.includes('json') || api.contentType?.includes('xml')) && api.responseSize && api.responseSize > 100);
  if (promisingApis.length > 0) {
    console.log('\n💎 Most Promising API Endpoints:');
    promisingApis.forEach(api => {console.log(`   ${api.method} ${api.url}`); console.log(`      Status: ${api.status}, Size: ${api.responseSize} chars, Type: ${api.contentType}`);});
  }
  console.log('\n' + '='.repeat(80));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('🚀 API Discovery Tool');
    console.log('Usage: npm run api-discovery <url>');
    console.log('Example: npm run api-discovery https://example.com');
    console.log('\nThis tool will:');
    console.log('  - Monitor all network requests');
    console.log('  - Identify API endpoints');
    console.log('  - Detect WebSocket connections');
    console.log('  - Find data endpoints');
    console.log('  - Analyze response content');
    process.exit(1);
  }
  const targetUrl = args[0];
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {console.error('Please provide a valid URL starting with http:// or https://'); process.exit(1);}
  try {
    const result = await discoverApis(targetUrl);
    printResults(result);
    const fs = await import('fs');
    const outputFile = `api-discovery-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${outputFile}`);
  } 
  catch (error) {console.error('Discovery failed:', error); process.exit(1);}
}

if (require.main === module) {main().catch(console.error);}
export { discoverApis, DiscoveryResult, ApiCall };