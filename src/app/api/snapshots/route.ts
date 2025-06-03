import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment variables
    const underdogApiKey = process.env.UNDERDOG_API_KEY;
    if (!underdogApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const postOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${underdogApiKey}`
      }
    };

    const response = await fetch('https://devnet.underdogprotocol.com/v2/snapshots', postOptions);
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to create snapshot', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Snapshot created:', data);

    return NextResponse.json({
      success: true,
      message: 'Snapshot created successfully',
      data: data
    });

  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';

    // Get API key from environment variables
    const underdogApiKey = process.env.UNDERDOG_API_KEY;
    if (!underdogApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const getOptions = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${underdogApiKey}`
      }
    };

    const response = await fetch(
      `https://devnet.underdogprotocol.com/v2/snapshots?page=${page}&limit=${limit}`,
      getOptions
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to fetch snapshots', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Snapshots fetched:', data);

    return NextResponse.json({
      success: true,
      data: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 