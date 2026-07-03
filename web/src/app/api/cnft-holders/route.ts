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
    let page: number | null = 1;
    let assetList: any[] = [];
    
    while (page) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "my-id",
          method: "getAssetsByGroup",
          params: {
            groupKey: "collection",
            groupValue: collectionAddress,
            page: page,
            limit: 1000,
          },
        }),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch assets from Helius' },
          { status: response.status }
        );
      }

      const { result = [] } = await response.json();
      
      if (!result.items) {
        break;
      }
      
      assetList.push(...result.items);
      
      if (result.total !== 1000) {
        page = null;
      } else {
        page++;
      }
    }

    if (assetList.length === 0) {
      return NextResponse.json(
        { error: 'No assets found for this collection' },
        { status: 404 }
      );
    }

    const rawList = assetList.map(item => item.ownership?.owner).filter(Boolean);
    const uniqueOwnersSet = new Set(rawList);
    const uniqueOwners = Array.from(uniqueOwnersSet);

    return NextResponse.json({
      uniqueOwners,
      totalAssets: assetList.length,
      uniqueOwnerCount: uniqueOwners.length
    });

  } catch (error) {
    console.error('Error fetching CNFT holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CNFT holders' },
      { status: 500 }
    );
  }
} 