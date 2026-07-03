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

    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    
    // Get native SOL balance
    const solBalanceResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-balance',
        method: 'getBalance',
        params: [address]
      })
    });
    
    const solBalanceData = await solBalanceResponse.json();
    
    // Get token accounts
    const tokenAccountsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-token-accounts',
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      })
    });
    
    const tokenAccountsData = await tokenAccountsResponse.json();
    
    const nativeBalance = solBalanceData.result?.value || 0;
    const tokenAccounts = tokenAccountsData.result?.value || [];
    
    const tokens = tokenAccounts.map((account: any) => ({
      mint: account.account.data.parsed.info.mint,
      amount: parseInt(account.account.data.parsed.info.tokenAmount.amount),
      decimals: account.account.data.parsed.info.tokenAmount.decimals
    }));
    
    console.log("SOL balance: ", nativeBalance / 1000000000);
    console.log("Token accounts: ", tokens);
    
    return NextResponse.json({
      nativeBalance,
      tokens
    });

  } catch (error) {
    console.error('Error fetching balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
} 