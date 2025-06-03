import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { underdogId } = await request.json();

    if (!underdogId) {
      return NextResponse.json(
        { error: 'Underdog ID is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const underdogApiKey = process.env.UNDERDOG_API_KEY;
    if (!underdogApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://mainnet.underdogprotocol.com/v2/projects/1/nfts/${underdogId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${underdogApiKey}`
      },
      body: JSON.stringify({
        attributes: {
          staked: 'true',
          supply: '222',
          price: '0',
          namespace: 'public'
        },
        name: 'The Pines',
        symbol: 'PINE',
        description: 'There\'s no need to pine over spilled milk.',
        image: 'https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png',
        externalUrl: 'https://t.me/+iVKU8g_o5j5jOWUx'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to stake Pine NFT', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Pine staked successfully:', data);

    return NextResponse.json({
      success: true,
      message: `Pine NFT ${underdogId} staked successfully`,
      data: data
    });

  } catch (error) {
    console.error('Error staking Pine NFT:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 