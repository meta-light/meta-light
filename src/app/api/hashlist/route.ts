import { NextRequest, NextResponse } from 'next/server';
import { HELIUS_API_KEY } from '../../env';

export async function POST(request: NextRequest) {
  try {
    const { collectionAddress } = await request.json();
    
    if (!collectionAddress) {
      return NextResponse.json(
        { error: 'Collection address is required' },
        { status: 400 }
      );
    }

    if (!HELIUS_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: collectionAddress,
          page: 1,
          limit: 1000
        }
      })
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch assets from Helius' },
        { status: response.status }
      );
    }

    const { result } = await response.json();
    
    if (!result || !result.items || result.items.length === 0) {
      return NextResponse.json(
        { error: 'No assets found for this collection' },
        { status: 404 }
      );
    }

    const owners = result.items.map((item: any) => item.ownership?.owner).filter(Boolean);
    const hashes = result.items.map((item: any) => item.id).filter(Boolean);

    return NextResponse.json({
      owners,
      hashes,
      totalItems: result.items.length
    });

  } catch (error) {
    console.error('Error fetching hashlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hashlist' },
      { status: 500 }
    );
  }
} 