import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get API keys from environment variables
    const underdogApiKey = process.env.UNDERDOG_API_KEY;
    const heliusApiKey = process.env.HELIUS_API_KEY;

    if (!underdogApiKey || !heliusApiKey) {
      return NextResponse.json(
        { error: 'API keys not configured' },
        { status: 500 }
      );
    }

    const underdogOptions = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${underdogApiKey}`
      }
    };

    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    const heliusOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: 'BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM',
          page: 1,
          limit: 1000
        }
      })
    };

    // Fetch data from both APIs
    const totalPages = 3;
    let underdogData: {
      id: string;
      ownerAddress: string;
      attributes: { staked: string };
      image: string;
      mintAddress: string;
    }[] = [];

    // Fetch Underdog data across multiple pages
    for (let i = 1; i <= totalPages; i++) {
      const response = await fetch(
        `https://mainnet.underdogprotocol.com/v2/projects/1/nfts?page=${i}&limit=100`,
        underdogOptions
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch Underdog data page ${i}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      underdogData = underdogData.concat(data.results);
    }

    // Fetch Helius data
    const heliusResponse = await fetch(heliusUrl, heliusOptions);
    if (!heliusResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Helius data' },
        { status: heliusResponse.status }
      );
    }

    const heliusResult = await heliusResponse.json();
    const heliusData: {
      id: string;
      ownership: { owner: string };
      content: {
        metadata: {
          attributes: { trait_type: string; value: string }[];
        };
        links: { image: string };
      };
    }[] = heliusResult.result.items;

    // Process and combine the data
    const pinesData = underdogData.map((item) => ({
      underdogId: item.id,
      underdogHolder: item.ownerAddress,
      underdogStaked: item.attributes.staked,
      image: item.image,
      mint: item.mintAddress,
      heliusHolder: heliusData.find((heliusItem) => heliusItem.id === item.mintAddress)?.ownership.owner || 'Unknown',
      heliusStaked: heliusData.find((heliusItem) => heliusItem.id === item.mintAddress)?.content.metadata.attributes.find(attr => attr.trait_type === 'staked')?.value || 'Unknown',
    }));

    // Filter for the specified wallet
    const pinesOwnedByWallet = pinesData.filter((item) => item.heliusHolder === walletAddress);

    // Calculate holdings statistics
    const pinesHolders = pinesData.reduce((acc: { [key: string]: number }, item) => {
      acc[item.heliusHolder] = (acc[item.heliusHolder] || 0) + 1;
      return acc;
    }, {});

    const walletOwnsAny = walletAddress in pinesHolders;

    return NextResponse.json({
      success: true,
      data: {
        ownedPines: pinesOwnedByWallet,
        walletOwnsAny,
        totalOwned: pinesOwnedByWallet.length,
        allHolders: pinesHolders
      }
    });

  } catch (error) {
    console.error('Error fetching Pine data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 