import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const vsToken = searchParams.get('vsToken');
  if (!token || !vsToken) {return NextResponse.json({ error: 'Token and vsToken are required' }, { status: 400 });}
  const url = `https://price.jup.ag/v4/price?ids=${token}&vsToken=${vsToken}`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' }});
  const data = await response.json();
  const price = data.data[token].price.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return NextResponse.json({ price });
}