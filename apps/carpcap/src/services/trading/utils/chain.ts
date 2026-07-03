import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, VersionedTransaction, Keypair } from '@solana/web3.js';
import { SOLANA_RPCS, SOLANA_PRIVATE_KEY, TOKENKEG_PROGRAM_ID } from '../../../env';
import { createSolanaClient, createNoopSigner, address, signTransactionMessageWithSigners, partiallySignTransactionMessageWithSigners, getExplorerLink, getSignatureFromTransaction } from 'gill';
import { delay } from '.';
import bs58 from 'bs58';

export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet' | 'localnet';
export type TransactionVersion = 'legacy' | 0;

if (!SOLANA_PRIVATE_KEY) {throw new Error('[solana]: Missing SOLANA_PRIVATE_KEY environment variable');}
export const connection = new Connection(SOLANA_RPCS[0]);
export const USER_KEYPAIR = Keypair.fromSecretKey(parsePrivateKey(SOLANA_PRIVATE_KEY));

function parsePrivateKey(privateKey: string): Uint8Array {
  try {return bs58.decode(privateKey);} 
  catch {
    try {const keyArray = JSON.parse(privateKey); if (Array.isArray(keyArray) && keyArray.length === 64) {return new Uint8Array(keyArray);}} 
    catch {
      try {const hexBuffer = Buffer.from(privateKey, 'hex'); if (hexBuffer.length === 64) {return new Uint8Array(hexBuffer);}} 
      catch {const buffer = Buffer.from(privateKey); if (buffer.length === 64) {return new Uint8Array(buffer);}}
    }
  }
  throw new Error('[solana]: Invalid private key format. Expected base58, JSON array, or 64-byte hex string');
}

export async function transferSol(fromWallet: PublicKey, toPublicKey: PublicKey, amount: number) {
  const transaction = new Transaction().add(SystemProgram.transfer({fromPubkey: fromWallet, toPubkey: toPublicKey, lamports: amount}));
  const signature = await sendTransactionWithRetry(connection, transaction, [fromWallet]);
  await connection.confirmTransaction(signature, 'confirmed');
  console.log(`[solana]: Transferred ${amount / LAMPORTS_PER_SOL} SOL to ${toPublicKey.toString()}`);
}

export function getSignature(transaction: Transaction | VersionedTransaction): string {
  const signature = 'signature' in transaction ? transaction.signature : transaction.signatures[0];
  if (!signature) {throw new Error('[solana]: Missing transaction signature, the transaction was not signed by the fee payer');}
  return bs58.encode(signature);
}

export async function sendTransactionWithRetry(connection: any, transaction: any, signers: any, maxRetries = 5) {
  const retries = 0;
  while (retries < maxRetries) {
    try {
      let signature;
      if (transaction instanceof VersionedTransaction) {signature = await connection.sendTransaction(transaction);} 
      else {signature = await connection.sendTransaction(transaction, signers, {preflightCommitment: 'confirmed'});}
      return signature;
    } 
    catch (error: any) {throw error;}
  }
  throw new Error(`[solana]: Failed to send transaction after ${maxRetries} attempts`);
}

export async function getBalances(pubKey: string, maxRetries = 3) {
  const walletPublicKey = new PublicKey(pubKey);
  let solBalanceLamports = 0;
  for (let i = 0; i < maxRetries; i++) {
    try {solBalanceLamports = await connection.getBalance(walletPublicKey); break;} 
    catch (error: any) {
      if (error.message.includes('429 Too Many Requests') && i < maxRetries - 1) {const delayTime = Math.pow(2, i) * 1000; await delay(delayTime);} 
      else {console.error(`[solana]: Error fetching balance: ${error.message}`); throw error;}
    }
  }
  const solBalance = (solBalanceLamports / LAMPORTS_PER_SOL).toFixed(4);
  let tokens: Array<{ mint: string; balance: number | null; decimals: number }> = [];
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {programId: new PublicKey(TOKENKEG_PROGRAM_ID)});
    tokens = tokenAccounts.value.map(({ account }) => {
      const parsedInfo = account.data.parsed.info;
      const mint = parsedInfo.mint;
      const tokenBalance = parsedInfo.tokenAmount.uiAmount !== null ? parsedInfo.tokenAmount.uiAmount : 0;
      const decimals = parsedInfo.tokenAmount.decimals;
      return { mint, balance: tokenBalance, decimals };
    });
  } 
  catch (error: any) {console.error(`[solana]: Error fetching token balances: ${error.message}`);}
  return { publicKey: pubKey, solBalance, tokens };
}

export async function bufferFromStr(wallet: any, programId: PublicKey, bufferFromStr: string) {
  const connection = new Connection(SOLANA_RPCS[0]);
  const publicKey = new PublicKey(wallet.publicKey);
  const [account] = PublicKey.findProgramAddressSync([Buffer.from(bufferFromStr), publicKey.toBuffer(), programId.toBuffer()], programId);
  try {
    const accountInfo = await connection.getAccountInfo(account);
    if (accountInfo === null) {return false;}
    return accountInfo.data.length > 0;
  } 
  catch (error) {console.error(`[solana]: Error checking mining status for ${wallet.publicKey}: ${error}`); return false;}
}

export async function getTokenSupply(mint: string): Promise<number> {
    try {
      const response = await fetch(SOLANA_RPCS[0], {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({'jsonrpc': '2.0', 'id': 'test', 'method': 'getAsset', 'params': {'id': mint}})});
      const data = await response.json();
      if (data && data.result && data.result.token_info) {
        const supply = data.result.token_info.supply;
        const decimals = data.result.token_info.decimals;
        let realSupply = parseFloat(supply);
        if (decimals != null) {realSupply = realSupply / Math.pow(10, Number(decimals));}
        return realSupply;
      }
      return 0;
    } 
    catch (error) {console.error('[helius]: Error fetching token supply:', error); return 0;}
}

export async function getTokenBalance(mint: string, walletAddress: string): Promise<number> {
    try {
      let page = 1;
      const limit = 100;
      let assetFound: any | null = null;
      while (true) {
        const response = await fetch(SOLANA_RPCS[0], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'jsonrpc': '2.0',
            'id': 'test',
            'method': 'getAssetsByOwner',
            'params': {
              'ownerAddress': walletAddress,
              page,
              limit,
              'before': '',
              'after': '',
              'options': {'showUnverifiedCollections': false, 'showCollectionMetadata': false, 'showGrandTotal': false, 'showFungible': true, 'showNativeBalance': false, 'showInscription': false, 'showZeroBalance': false},
              'sortBy': { 'sortBy': 'created', 'sortDirection': 'asc' }
            }
          })
        });
        const data = await response.json();
        const assets = data.result?.items || [];
        assetFound = assets.find((asset: any) => asset.id && asset.id.toLowerCase() === mint.toLowerCase());
        if (assetFound) {break;}
        if (assets.length < limit) {break;}
        page++;
      }
      if (assetFound) {
        if (assetFound.token_info && assetFound.token_info.balance != null && assetFound.token_info.decimals != null) {
          const rawBalance = parseFloat(assetFound.token_info.balance);
          const decimals = Number(assetFound.token_info.decimals);
          return rawBalance / Math.pow(10, decimals);
        } 
        else if (assetFound.balance) {return parseFloat(assetFound.balance);}
      }
      return 0;
    } 
    catch (error) {console.error('[helius]: Error fetching token balance:', error); return 0;}
}

export async function getCurrentSlot(network: SolanaNetwork) {
  const { rpc } = createSolanaClientForNetwork(network);
  const slot = await rpc.getSlot().send();
  return slot;
}

export async function getLatestBlockhash(network: SolanaNetwork) {
  const { rpc } = createSolanaClientForNetwork(network);
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  return latestBlockhash;
}

export async function signTransaction(transaction: any) {return await signTransactionMessageWithSigners(transaction);}
export async function partiallySignTransaction(transaction: any) {return await partiallySignTransactionMessageWithSigners(transaction);}
export function getTransactionSignature(signedTransaction: any): string {return getSignatureFromTransaction(signedTransaction);}
export function getTransactionExplorerLink(signature: string, cluster: SolanaNetwork): string {return getExplorerLink({transaction: signature, cluster});}
export function createSolanaClientForNetwork(network: SolanaNetwork) {return createSolanaClient({urlOrMoniker: network});}
export function createNoopSignerForAddress(addressString: string) {const userAddress = address(addressString); return createNoopSigner(userAddress);}

export async function signAndGetTransactionInfo(transaction: any, network: SolanaNetwork) {
  const signedTransaction = await signTransaction(transaction);
  const signature = getTransactionSignature(signedTransaction);
  const explorerLink = getTransactionExplorerLink(signature, network);
  return {signedTransaction, signature, explorerLink};
}

export async function sendAndConfirmSolanaTransaction(transaction: any, network: SolanaNetwork) {
  const { sendAndConfirmTransaction } = createSolanaClientForNetwork(network);
  return await sendAndConfirmTransaction(transaction);
}