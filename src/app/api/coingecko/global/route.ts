import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global', {headers: {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0'},});
    if (!response.ok) {throw new Error(`CoinGecko API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=60'}});
  } 
  catch (error) {
    console.error('CoinGecko Global API error:', error);
    return NextResponse.json({ error: 'Failed to fetch global market data' }, { status: 500 });
  }
} 