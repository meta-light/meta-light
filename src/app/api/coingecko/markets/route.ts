import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coingeckoUrl = new URL('https://api.coingecko.com/api/v3/coins/markets');
    searchParams.forEach((value, key) => {coingeckoUrl.searchParams.append(key, value);});
    const response = await fetch(coingeckoUrl.toString(), {headers: {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0'},});
    if (!response.ok) {throw new Error(`CoinGecko API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=30'}});
  } 
  catch (error) {
    console.error('CoinGecko Markets API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
} 