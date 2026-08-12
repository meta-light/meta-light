import { NextRequest, NextResponse } from 'next/server';

// /api/coingecko/market-chart?id=bitcoin&vs_currency=usd&days=90
// Proxies CoinGecko's /coins/{id}/market_chart so the signal charts get OHLC-free price
// history without exposing the upstream call (or an API key) to the browser.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {return NextResponse.json({ error: 'Missing required "id" query parameter' }, { status: 400 });}
    const vsCurrency = searchParams.get('vs_currency') || 'usd';
    const days = searchParams.get('days') || '90';
    const coingeckoUrl = new URL(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart`);
    coingeckoUrl.searchParams.set('vs_currency', vsCurrency);
    coingeckoUrl.searchParams.set('days', days);
    const interval = searchParams.get('interval');
    if (interval) {coingeckoUrl.searchParams.set('interval', interval);}
    const headers: Record<string, string> = {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0'};
    if (process.env.COINGECKO_API_KEY) {headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;}
    const response = await fetch(coingeckoUrl.toString(), { headers });
    if (!response.ok) {throw new Error(`CoinGecko API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=60'}});
  }
  catch (error) {
    console.error('CoinGecko Market Chart API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market chart data' }, { status: 500 });
  }
}
