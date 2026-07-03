import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const page = searchParams.get('page');
  const limit = searchParams.get('limit');
  const sortDirection = searchParams.get('sortDirection');
  const url = `https://api.portals.fi/v2/tokens?search=${ticker}&sortDirection=${sortDirection}&limit=${limit}&page=${page}`;
  const response = await fetch(url, { method: 'GET',  headers: { 'accept': 'application/json', 'Authorization': 'Bearer <bearer>' }});
  const data = await response.json();
  const price = data.tokens[1].price;
  return NextResponse.json({ price });
}