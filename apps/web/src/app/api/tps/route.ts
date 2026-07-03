import { Helius } from 'helius-sdk';
import { HELIUS_API_KEY } from '../../env';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (!HELIUS_API_KEY) {
    return NextResponse.json({ error: 'HELIUS_API_KEY is not set' }, { status: 500 });
  }
  
  const helius = new Helius(HELIUS_API_KEY);
  
  try {
    const tps = await helius.rpc.getCurrentTPS();
    return NextResponse.json({ tps }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}