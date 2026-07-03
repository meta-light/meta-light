import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { receiverAddress } = await request.json();

    if (!receiverAddress) {
      return NextResponse.json(
        { error: 'Receiver address is required' },
        { status: 400 }
      );
    }

    if (receiverAddress.length < 30) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        { status: 400 }
      );
    }

    const apiKey = process.env.UNDERDOG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        receiverAddress: receiverAddress,
        name: 'Nick Carpinito Business Card',
        symbol: 'NICK',
        description: 'X: https://twitter.com/0xMetaLight Github: https://github.com/meta-light',
        image: 'https://updg8.storage.googleapis.com/bb6550c4-7919-4ce8-bdf6-e5894557dfa6',
        externalUrl: 'https://carpinito.id/'
      })
    };

    const response = await fetch('https://api.underdogprotocol.com/v2/projects/4/nfts', options);
    const data = await response.json();

    console.log('API Response:', data);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to mint NFT', details: data },
        { status: response.status }
      );
    }

    if (data.projectId === 4) {
      return NextResponse.json({
        success: true,
        message: `Business Card minted to ${receiverAddress}`,
        data: data
      });
    } else {
      return NextResponse.json(
        { error: 'Error minting Business Card', details: data },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
