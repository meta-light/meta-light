import { NextRequest, NextResponse } from 'next/server';
import { CRYPTO_PANIC_KEY } from '../../../env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (!CRYPTO_PANIC_KEY) {throw new Error('CRYPTO_PANIC_KEY is not set');}
    const cryptoPanicUrl = new URL('https://cryptopanic.com/api/v1/posts/');
    cryptoPanicUrl.searchParams.append('auth_token', CRYPTO_PANIC_KEY);
    const allowedParams = ['currencies', 'filter', 'approved', 'kind', 'regions'];
    allowedParams.forEach(param => {const value = searchParams.get(param); if (value) {cryptoPanicUrl.searchParams.append(param, value);}});
    const response = await fetch(cryptoPanicUrl.toString(), {headers: {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0',},});
    if (!response.ok) {throw new Error(`CryptoPanic API error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=120',},});
  } 
  catch (error) {
    console.error('CryptoPanic API error:', error);
    return NextResponse.json({ error: 'Failed to fetch CryptoPanic data' }, { status: 500 });
  }
} 