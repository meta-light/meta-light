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
    
    // Fetch all assets with pagination
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

      const { result = {} } = await response.json();
      
      if (result.items && result.items.length > 0) {
        assetList.push(...result.items);
      }
      
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

    // Process ownership data to get unique owners
    const rawList = assetList.map(item => item.ownership?.owner).filter(Boolean);
    let uniqueOwners: string[] = [];
    rawList.forEach(owner => {
      if (!uniqueOwners.includes(owner)) {
        uniqueOwners.push(owner);
      }
    });

    // Try to call the existing processDuplicates API if it exists
    try {
      const processResponse = await fetch(`${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_VERCEL_URL || 'https://your-domain.com'}/api/processDuplicates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: uniqueOwners })
      });

      if (processResponse.ok) {
        const processResult = await processResponse.json();
        return NextResponse.json({
          success: true,
          uniqueOwners,
          totalAssets: assetList.length,
          uniqueOwnerCount: uniqueOwners.length,
          downloadPath: processResult.path
        });
      }
    } catch (processError) {
      console.log('processDuplicates API not available, returning raw data');
    }

    // If processDuplicates API is not available, return the data directly
    return NextResponse.json({
      success: true,
      uniqueOwners,
      totalAssets: assetList.length,
      uniqueOwnerCount: uniqueOwners.length
    });

  } catch (error) {
    console.error('Error generating snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to generate snapshot' },
      { status: 500 }
    );
  }
} 