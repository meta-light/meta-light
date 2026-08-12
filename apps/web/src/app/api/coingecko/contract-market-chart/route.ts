import { NextRequest, NextResponse } from 'next/server';

// /api/coingecko/contract-market-chart?platform=solana&address=So111...&days=90
// The terminal chart identifies tokens by contract address, not by CoinGecko id, so the
// signal panel needs the by-contract variant of market_chart to follow the same token.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const address = searchParams.get('address');
    if (!platform || !address) {return NextResponse.json({ error: 'Missing required "platform" and "address" query parameters' }, { status: 400 });}
    const vsCurrency = searchParams.get('vs_currency') || 'usd';
    const days = searchParams.get('days') || '90';
    const coingeckoUrl = new URL(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(platform)}/contract/${encodeURIComponent(address)}/market_chart`
    );
    coingeckoUrl.searchParams.set('vs_currency', vsCurrency);
    coingeckoUrl.searchParams.set('days', days);
    const headers: Record<string, string> = {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0'};
    if (process.env.COINGECKO_API_KEY) {headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;}
    const response = await fetch(coingeckoUrl.toString(), { headers });
    // Plenty of tradeable tokens simply are not indexed by CoinGecko, and the public API
    // rate-limits hard without a key. Both are expected outcomes here, not server errors —
    // pass them through so the panel can say something useful instead of "failed to fetch".
    if (response.status === 404) {return NextResponse.json({ error: 'CoinGecko does not index this contract address' }, { status: 404 });}
    if (response.status === 429) {return NextResponse.json({ error: 'CoinGecko rate limit reached — try again in a moment' }, { status: 429 });}
    if (!response.ok) {throw new Error(`CoinGecko API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=60'}});
  }
  catch (error) {
    console.error('CoinGecko Contract Market Chart API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market chart data' }, { status: 500 });
  }
}
