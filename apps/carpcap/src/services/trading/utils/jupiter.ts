import { Connection, VersionedTransaction, BlockhashWithExpiryBlockHeight, TransactionExpiredBlockheightExceededError, VersionedTransactionResponse } from '@solana/web3.js';
import fetch from 'isomorphic-fetch';
import { createJupiterApiClient, type QuoteResponse, type QuoteGetRequest } from '@jup-ag/api';
import { Wallet } from '@project-serum/anchor';
import promiseRetry from 'promise-retry';
import { getSignature, connection, USER_KEYPAIR } from './chain';
import { delay } from '.';
const jupiterQuoteApi = createJupiterApiClient();

// export async function getHighQualityTradingTokens(maxTokens: number = 50, existingTokenAddresses: Set<string> = new Set()): Promise<Array<{ticker: string, address: string, decimals: number, marketCapUsd: number, volumeUsd: number}>> {
//   try {
//       const response = await fetch('https://api.kamino.finance/kamino-swap/tokens');
//       const tokens = await response.json();
//       const excludedSymbols = new Set(['SOL', 'WSOL', 'USDC', 'USDT', 'USDY', 'PYUSD', 'UXD', 'PAI']);
//       const excludedMints = new Set([
//           'So11111111111111111111111111111111111111112', // Wrapped SOL
//           'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
//           'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT // move to config.
//           ...Array.from(existingTokenAddresses)
//       ]);
//       const candidateTokens = tokens
//           .filter((token: any) => {
//               if (!token.verified) return false;
//               if (excludedSymbols.has(token.symbol) || excludedMints.has(token.mint)) return false;
//               const volume = parseFloat(token.volumeUsd || '0');
//               if (volume < 1_000_000) return false;                
//               return true;
//           })
//           .map((token: any) => ({
//               ticker: token.symbol,
//               address: token.mint,
//               decimals: token.decimals,
//               marketCapUsd: parseFloat(token.marketCapUsd || '0'),
//               volumeUsd: parseFloat(token.volumeUsd || '0'),
//               priority: token.priority || 0
//           }))
//           .sort((a: any, b: any) => {
//               const scoreA = (a.volumeUsd * 0.7) + (a.marketCapUsd * 0.3);
//               const scoreB = (b.volumeUsd * 0.7) + (b.marketCapUsd * 0.3);
//               return scoreB - scoreA;
//           });
//       const validatedTokens = await validateTokensWithJupiter(candidateTokens, maxTokens);
//       return validatedTokens;
//   } 
//   catch (error) {console.error('Failed to fetch tokens from Kamino API:', error); return [];}
// }

// async function validateTokensWithJupiter(candidateTokens: Array<{ticker: string, address: string, decimals: number, marketCapUsd: number, volumeUsd: number}>, maxTokens: number): Promise<Array<{ticker: string, address: string, decimals: number, marketCapUsd: number, volumeUsd: number}>> {
//   const validatedTokens: Array<{ticker: string, address: string, decimals: number, marketCapUsd: number, volumeUsd: number}> = [];
//   const batchSize = 50;
//   for (let i = 0; i < candidateTokens.length && validatedTokens.length < maxTokens; i += batchSize) {
//     const batch = candidateTokens.slice(i, i + batchSize);
//     const tokenIds = batch.map(token => token.address).join(',');
//     try {
//       const response = await fetch(`https://lite-api.jup.ag/price/v2?ids=${tokenIds}&showExtraInfo=true`);
//       const priceData = await response.json();
//       if (priceData && priceData.data) {
//         for (const token of batch) {
//           if (validatedTokens.length >= maxTokens) break;
//           const tokenPriceData = priceData.data[token.address];
//           if (tokenPriceData && tokenPriceData.price) {
//             const price = parseFloat(tokenPriceData.price);
//             if (price > 0 && price < 1000000) {
//               if (tokenPriceData.extraInfo) {
//                 const { extraInfo } = tokenPriceData;
//                 if (extraInfo.quotedPrice && extraInfo.depth) {
//                   const buyPrice = parseFloat(extraInfo.quotedPrice.buyPrice || '0');
//                   const sellPrice = parseFloat(extraInfo.quotedPrice.sellPrice || '0');
//                   if (buyPrice > 0 && sellPrice > 0) {
//                     const spread = Math.abs(buyPrice - sellPrice) / price;
//                     if (spread < 0.05) {validatedTokens.push(token); continue;}
//                   }
//                 }
//               }
//               validatedTokens.push(token);
//             }
//           } 
//           else {if (Math.random() < 0.1) {console.log(`[Jupiter] No price data for ${token.ticker} (${token.address})`);}}
//         }
//       }
//     } 
//     catch (error) {console.error(`Error validating batch starting at index ${i}:`, error);}
//     if (i + batchSize < candidateTokens.length) {await new Promise(resolve => setTimeout(resolve, 200));}
//   }
//   console.log(`[Jupiter] Validated ${validatedTokens.length}/${candidateTokens.length} tokens with Jupiter price data`);
//   return validatedTokens;
// }

export async function getQuote(inputTokenAddress: string, outputTokenAddress: string, inputAmount: number, inputTokenDecimals?: number, slippageBps?: number): Promise<QuoteResponse | null> {
  try {
    let decimals: number;
    if (inputTokenDecimals !== undefined) {decimals = inputTokenDecimals;} 
    else {
      const tokens = await (await fetch('https://price.jup.ag/v4/token-list')).json();
      decimals = tokens.find((t: any) => t.address === inputTokenAddress)?.decimals || 9;
    }
    const convertedAmount = Math.round(inputAmount * Math.pow(10, decimals));
    const params: QuoteGetRequest = {inputMint: inputTokenAddress, outputMint: outputTokenAddress, amount: convertedAmount, ...(slippageBps && {slippageBps})};
    const quote = await jupiterQuoteApi.quoteGet(params);
    if (!quote) {throw new Error('Jupiter: unable to quote');}
    return quote;
  } 
  catch (error: any) {console.error(`Error getting quote: ${error.message}`); return null;}
}

export async function swap(inputTokenAddress: string, outputTokenAddress: string, inputAmount: number, slippageBps: number = 300, wallet?: Wallet): Promise<string | null> {
  try {
    const swapWallet = wallet || new Wallet(USER_KEYPAIR);
    const tokens = await (await fetch('https://price.jup.ag/v4/token-list')).json();
    const inputToken = tokens.find((t: any) => t.address === inputTokenAddress);
    if (!inputToken) {throw new Error(`Input token ${inputTokenAddress} not found`);}
    const quote = await getQuote(inputTokenAddress, outputTokenAddress, inputAmount, inputToken.decimals, slippageBps);
    if (!quote) {throw new Error('Unable to get quote');}
    const swapResponse = await jupiterQuoteApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: swapWallet.publicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        dynamicSlippage: {maxBps: slippageBps},
        prioritizationFeeLamports: {priorityLevelWithMaxLamports: { maxLamports: 10000000, priorityLevel: 'veryHigh' }, correctLastValidBlockHeight: true}
      }
    });
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([swapWallet.payer]);
    const signature = getSignature(transaction);
    const { value: simulatedTransactionResponse } = await connection.simulateTransaction(transaction, {replaceRecentBlockhash: true, commitment: 'processed'});
    const { err, logs } = simulatedTransactionResponse;
    if (err) {console.error('Simulation Error:', { err, logs }); return null;}
    const serializedTransaction = Buffer.from(transaction.serialize());
    const blockhash = transaction.message.recentBlockhash;
    const transactionResponse = await transactionSenderAndConfirmationWaiter({connection, serializedTransaction, blockhashWithExpiryBlockHeight: {blockhash, lastValidBlockHeight: swapResponse.lastValidBlockHeight}});
    if (!transactionResponse) {console.error('Transaction not confirmed'); return null;}
    if (transactionResponse.meta?.err) {console.error(transactionResponse.meta.err); return null;}
    console.log(`https://solscan.io/tx/${signature}`);
    return signature;
  } 
  catch (error: any) {console.error('Swap error:', error); return null;}
}

async function transactionSenderAndConfirmationWaiter({connection, serializedTransaction, blockhashWithExpiryBlockHeight}: {connection: Connection; serializedTransaction: Buffer; blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;}): Promise<VersionedTransactionResponse | null> {
  const txid = await connection.sendRawTransaction(serializedTransaction, {skipPreflight: true});
  const controller = new AbortController();
  const abortSignal = controller.signal;
  const abortableResender = async () => {
    while (true) {
      await delay(2_000);
      if (abortSignal.aborted) return;
      try {await connection.sendRawTransaction(serializedTransaction, {skipPreflight: true});} 
      catch (e) {console.warn(`Failed to resend transaction: ${e}`);}
    }
  };
  try {
    abortableResender();
    const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight;
    await Promise.race([
      connection.confirmTransaction({...blockhashWithExpiryBlockHeight, lastValidBlockHeight, signature: txid, abortSignal}, 'confirmed'),
      new Promise(async (resolve) => {
        while (!abortSignal.aborted) {
          await delay(2_000);
          const tx = await connection.getSignatureStatus(txid, {searchTransactionHistory: false});
          if (tx?.value?.confirmationStatus === 'confirmed') {resolve(tx);}
        }
      })
    ]);
  } 
  catch (e) {if (e instanceof TransactionExpiredBlockheightExceededError) {return null;}  else {throw e;}} 
  finally {controller.abort();}
  const response = promiseRetry(
    async (retry: any) => {
      const response = await connection.getTransaction(txid, {commitment: 'confirmed', maxSupportedTransactionVersion: 0});
      if (!response) {retry(response);}
      return response;
    }, {retries: 5, minTimeout: 1e3}
  );
  return response;
}