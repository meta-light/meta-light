import { SwapSDK, DEX_IDS, PairNotAvailableOnDexError, TooManyAccountsLockError, SameTokenSwapError } from '@deserialize/swap-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { ECLIPSE_RPCS } from '../../../env';
import { USER_KEYPAIR } from './chain';
const connection = new Connection(ECLIPSE_RPCS[0]);
const sdk = new SwapSDK();
const userKeypair = USER_KEYPAIR;
const userPublicKey = userKeypair.publicKey;
import { getTokenPrices } from '../trading/price';

export async function detailedSwapFlow(tokenA: string, tokenB: string, amountIn: number) {
    try {
        const tokenMints = [tokenA, tokenB];
        const balances = await sdk.getTokenMintBalance({userAddress: userPublicKey.toBase58(), tokenMints});
        if (balances[0].balanceUiAmount < 10.0) {throw new Error('[deserialize]: Insufficient balance for Token A');}
        const swapParams = {publicKey: userPublicKey, tokenA: new PublicKey(tokenMints[0]), tokenB: new PublicKey(tokenMints[1]), amountIn, dexId: DEX_IDS.ALL, options: { reduceToTwoHops: true }};
        const quote = await sdk.getSwapQuote(swapParams);
        const txResult = await sdk.getSwapTransaction({publicKey: userPublicKey, quote});
        const simulation = await sdk.simulateTransaction(connection, txResult.transaction);
        if (simulation.err) {throw new Error('[deserialize]: Simulation failed');}
        txResult.transaction.sign([userKeypair, ...txResult.signers]);
        const signature = await connection.sendRawTransaction(txResult.transaction.serialize(), { skipPreflight: false });
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        return confirmation;
    } 
    catch (error) {
        console.error('[deserialize]: Swap failed:', error);
        if (error instanceof SameTokenSwapError) {console.error('[deserialize]: Cannot swap the same token');} 
        else if (error instanceof PairNotAvailableOnDexError) {console.error('[deserialize]: Token pair not available on specified DEX');} 
        else if (error instanceof TooManyAccountsLockError) {console.error('[deserialize]: Too many account locks; try reduceToTwoHops: true');}
    }
}

export async function getTokenInformation() {
    try {const tokens = await sdk.tokenList(); return tokens;} 
    catch (error) {console.error('[deserialize]: Error fetching token list:', error); throw error;}
}
  
export async function getRate(tokenA: string, tokenB: string) {
    try {
        const prices = await getTokenPrices();
        if (prices) {
            const priceA = prices.find(p => p.token === tokenA);
            const priceB = prices.find(p => p.token === tokenB);
            if (priceA && priceB) {return priceA.price / priceB.price;}
            else {throw new Error(`[deserialize]: Token ${tokenA} or ${tokenB} not found`);}
        }
    } 
    catch (error) {console.error('[deserialize]: Error calculating ETH/USDC rate:', error);}
}

export async function checkUserBalances(userAddress: string) {
    try {
        const tokens = await sdk.tokenList();
        const tokenAddresses = tokens.filter(t => ['ETH', 'USDC', 'SOL', 'tETH'].includes(t.symbol)).map(t => t.address);
        const balances = await sdk.getTokenMintBalance({userAddress, tokenMints: tokenAddresses});
        return balances;
    } 
    catch (error) {console.error('[deserialize]: Error checking balances:', error); throw error;}
}

export async function findBestRate(fromToken: string, toToken: string, amount: number) {
    const dexesToCheck = [DEX_IDS.ORCA, DEX_IDS.INVARIANT, DEX_IDS.LIFINITY, DEX_IDS.UMBRA];
    const results: Array<{dex: string; amountOut: number; price: number; priceImpact: number; routePlan?: any;}> = [];
    for (const dex of dexesToCheck) {
        try {
            const quote = await sdk.getSwapQuote({publicKey: userPublicKey, tokenA: new PublicKey(fromToken), tokenB: new PublicKey(toToken), amountIn: amount, dexId: dex});
            results.push({dex, amountOut: Number(quote.amountOut), price: Number(quote.tokenPrice), priceImpact: Number(quote.priceImpact)});
        } 
        catch (error: any) {console.log(`[deserialize]: No route available on ${dex}: ${error.message}`);}
    }
    try {
        const aggregatedQuote = await sdk.getSwapQuote({publicKey: userPublicKey, tokenA: new PublicKey(fromToken), tokenB: new PublicKey(toToken), amountIn: amount, dexId: DEX_IDS.ALL});
        results.push({dex: 'ALL (Smart Routing)', amountOut: Number(aggregatedQuote.amountOut), price: Number(aggregatedQuote.tokenPrice), priceImpact: Number(aggregatedQuote.priceImpact), routePlan: aggregatedQuote.routePlan});
    } 
    catch (error: any) {console.log(`[deserialize]: Error with aggregated routing: ${error.message}`);}
    results.sort((a, b) => b.amountOut - a.amountOut);
    return results;
}

export async function executeOptimizedSwap(userPublicKey: PublicKey, tokenAPublicKey: PublicKey, tokenBPublicKey: PublicKey, amountIn: number) {
    try {
        const swapParams = {publicKey: userPublicKey, tokenA: tokenAPublicKey, tokenB: tokenBPublicKey, amountIn, dexId: DEX_IDS.ALL, options: { reduceToTwoHops: true }};
        const quote = await sdk.getSwapQuote(swapParams);
        return quote;
    } 
    catch (error) {console.error('[deserialize]: Route optimization failed:', error); throw error;}
}

export async function getCustomSwapQuote(tokenA: string, tokenB: string, amountIn: number, dexId: any) {
    try {
        const quote = await sdk.getSwapQuote({publicKey: userPublicKey, tokenA: new PublicKey(tokenA), tokenB: new PublicKey(tokenB), amountIn, dexId});
        return quote;
    } 
    catch (error) {console.error('[deserialize]: Failed to get custom route:', error); throw error;}
}

export async function checkSufficientBalance(userAddress: string, tokenMint: string, amountNeeded: number) {
    try {
      const balances = await sdk.getTokenMintBalance({userAddress, tokenMints: [tokenMint]});
      const balance = balances.find(b => b.mint === tokenMint);
      if (!balance || balance.balanceUiAmount < amountNeeded) {throw new Error('[deserialize]: Insufficient balance.');}
      return true;
    } 
    catch (error) {console.error('[deserialize]: Balance check failed:', error); throw error;}
}

export async function compareDEXQuotes(tokenA: string, tokenB: string, amountIn: number) {
    const dexes = [DEX_IDS.ORCA, DEX_IDS.INVARIANT, DEX_IDS.LIFINITY, DEX_IDS.UMBRA];
    const quotes = [];
    for (const dex of dexes) {
        try {
            const quote = await sdk.getSwapQuote({publicKey: userPublicKey, tokenA: new PublicKey(tokenA), tokenB: new PublicKey(tokenB), amountIn, dexId: dex});
            quotes.push({dex, amountOut: Number(quote.amountOut), priceImpact: Number(quote.priceImpact)});
        } 
        catch (error) {console.log(`[deserialize]: No route available on ${dex}`); throw error;}
    }
    quotes.sort((a, b) => b.amountOut - a.amountOut);
    return quotes;
}

export async function batchedSwaps(swapParams1: any, swapParams2: any) {
    try {
        const txResult1 = await sdk.swapTx(swapParams1);
        const txResult2 = await sdk.swapTx(swapParams2);
        return {transactions: [txResult1.transaction, txResult2.transaction], results: [txResult1, txResult2]};
    } 
    catch (error) {console.error('[deserialize]: Transaction batching failed:', error); throw error;}
}