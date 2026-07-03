import { NextResponse } from 'next/server';

export async function GET({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const response = await fetch('https://api.coingecko.com/api/v3/coins/categories/' + id, {headers: {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0',},});
    if (!response.ok) {throw new Error(`CoinGecko API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=60',},});
  } 
  catch (error) {
    console.error('CoinGecko API error:', error);
    return NextResponse.json({ error: 'Failed to fetch global market data' }, { status: 500 });
  }
}