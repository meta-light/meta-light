import { NextRequest, NextResponse } from 'next/server';
import { HELIUS_API_KEY } from '../../env';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!HELIUS_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch transaction data from Helius' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found for this address' },
        { status: 404 }
      );
    }
    
    const slots = data.map(entry => entry.slot);
    slots.sort((a, b) => a - b);
    const lowestslot = slots[0];
    const lowestslotEntry = data.find(entry => entry.slot === lowestslot);
    
    return NextResponse.json({
      slots,
      lowestslot,
      lowestslotEntry
    });

  } catch (error) {
    console.error('Error fetching first transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch first transaction' },
      { status: 500 }
    );
  }
} 