import { TICK_SEARCH_RANGE, Market, Network, Pair } from '@invariant-labs/sdk-eclipse';
import { createNativeAtaInstructions, getTokenProgramAddress, WrappedEthTransferInstructions } from '@invariant-labs/sdk-eclipse/lib/utils';
import { findClosestTicks } from '@invariant-labs/sdk-eclipse/lib/math';
import { WrappedEthInstructions } from '@invariant-labs/sdk-eclipse/lib/utils';
import { Keypair } from '@solana/web3.js';
import { createNativeAtaWithTransferInstructions, simulateSwap, SimulationStatus } from '@invariant-labs/sdk-eclipse/lib/utils';
import { Decimal, Tick, TICK_CROSSES_PER_IX, TICK_CROSSES_PER_IX_NATIVE_TOKEN, TICK_VIRTUAL_CROSSES_PER_IX } from '@invariant-labs/sdk-eclipse/lib/market';
import { swapSimulation, toDecimal } from '@invariant-labs/sdk-eclipse/lib/utils';
import { getAssociatedTokenAddressSync, NATIVE_MINT } from '@solana/spl-token';
import { AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';

export interface SwapParams {
  xToY: boolean;
  byAmountIn: boolean;
  swapAmount: BN;
  slippage: Decimal;
  pair: Pair;
  accountX: PublicKey;
  accountY: PublicKey;
  owner: Keypair;
  referralAccount?: PublicKey;
}

export interface MarketConfig {
  connection: Connection;
  privateKey: string;
  rpcUrl: string;
  network: Network;
}

export async function initializeMarket(config: MarketConfig): Promise<{ market: Market; provider: AnchorProvider }> {
  const connection = new Connection(config.rpcUrl);
  const wallet = new Wallet(Keypair.fromSecretKey(Buffer.from(config.privateKey, 'base64')));
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const market = await Market.build(config.network, provider.wallet, connection);
  return { market, provider };
}

export function calculateMaxCrosses(pair: Pair, referralAccount?: PublicKey): number {
  let maxCrosses = TICK_CROSSES_PER_IX;
  const isTokenNative = pair.tokenX.equals(NATIVE_MINT) || pair.tokenY.equals(NATIVE_MINT);
  if (isTokenNative) {maxCrosses = TICK_CROSSES_PER_IX_NATIVE_TOKEN;}
  if (referralAccount) {maxCrosses -= 1;}
  return maxCrosses;
}

export async function performSwapSimulation(market: Market, params: SwapParams, maxCrosses: number): Promise<any> {
  const simulation = await swapSimulation(
    params.xToY,
    params.byAmountIn,
    params.swapAmount,
    undefined,
    params.slippage,
    market,
    params.pair.getAddress(market.program.programId),
    maxCrosses,
    TICK_VIRTUAL_CROSSES_PER_IX
  );
  if (simulation.status !== SimulationStatus.Ok) {throw new Error(`Simulation failed: ${simulation.status}`);}
  return simulation;
}

export async function executeSimpleSwap(market: Market, params: SwapParams): Promise<string> {
  const maxCrosses = calculateMaxCrosses(params.pair, params.referralAccount);
  const simulation = await performSwapSimulation(market, params, maxCrosses);
  const swapSlippage = toDecimal(0, 0);
  const txHash = await market.swap({
    xToY: params.xToY,
    estimatedPriceAfterSwap: simulation.priceAfterSwap,
    pair: params.pair,
    amount: params.swapAmount,
    slippage: swapSlippage,
    byAmountIn: params.byAmountIn,
    accountX: params.accountX,
    accountY: params.accountY,
    owner: params.owner.publicKey
  }, params.owner);
  return txHash;
}

export function setupWrappedEthAccounts(wrappedEthPair: Pair, owner: Keypair, swapAmount: BN, xToY: boolean): {
  wrappedEthAccount: Keypair;
  wethTxs: WrappedEthInstructions | WrappedEthTransferInstructions;
  accountX: PublicKey;
  accountY: PublicKey;
  isWrappedEthInput: boolean;
} {
  const wrappedEthAccount = Keypair.generate();
  const isWrappedEthInput = (xToY && wrappedEthPair.tokenX.equals(NATIVE_MINT)) || (!xToY && wrappedEthPair.tokenY.equals(NATIVE_MINT));
  let wethTxs: WrappedEthInstructions | WrappedEthTransferInstructions;
  if (isWrappedEthInput) {wethTxs = createNativeAtaWithTransferInstructions(wrappedEthAccount.publicKey, owner.publicKey, Network.LOCAL, swapAmount);} 
  else {wethTxs = createNativeAtaInstructions(wrappedEthAccount.publicKey, owner.publicKey, Network.LOCAL);}
  let token: PublicKey;
  if (wrappedEthPair.tokenX.equals(NATIVE_MINT)) {token = wrappedEthPair.tokenY;} 
  else {token = wrappedEthPair.tokenX;}
  const userTokenAccount = getAssociatedTokenAddressSync(token, owner.publicKey);
  let accountX: PublicKey;
  let accountY: PublicKey;
  if (wrappedEthPair.tokenX.equals(NATIVE_MINT)) {accountX = wrappedEthAccount.publicKey; accountY = userTokenAccount;} 
  else {accountX = userTokenAccount; accountY = wrappedEthAccount.publicKey;}
  return {wrappedEthAccount, wethTxs, accountX, accountY, isWrappedEthInput};
}

export async function executeWrappedEthSwap(market: Market, wrappedEthPair: Pair, owner: Keypair, swapAmount: BN, xToY: boolean, byAmountIn: boolean, slippage: Decimal, referralAccount?: PublicKey): Promise<string> {
  const maxCrosses = calculateMaxCrosses(wrappedEthPair, referralAccount);
  const simulation = await swapSimulation(
    xToY,
    byAmountIn,
    swapAmount,
    undefined,
    slippage,
    market,
    wrappedEthPair.getAddress(market.program.programId),
    maxCrosses,
    TICK_VIRTUAL_CROSSES_PER_IX
  );
  if (simulation.status !== SimulationStatus.Ok) {throw new Error(`Wrapped ETH simulation failed: ${simulation.status}`);}
  const {wrappedEthAccount, wethTxs, accountX, accountY, isWrappedEthInput} = setupWrappedEthAccounts(wrappedEthPair, owner, swapAmount, xToY);
  const swapSlippage = toDecimal(0, 0);
  const txHash = await market.swap(
    {
      xToY,
      estimatedPriceAfterSwap: simulation.priceAfterSwap,
      pair: wrappedEthPair,
      amount: simulation.accumulatedAmountIn,
      slippage: swapSlippage,
      byAmountIn,
      accountX,
      accountY,
      owner: owner.publicKey
    },
    owner
  );
  return txHash;
}

export async function queryOptimalTicks(market: Market, pair: Pair, xToY: boolean, connection: Connection): Promise<{
  pool: any;
  tokenXProgram: PublicKey;
  tokenYProgram: PublicKey;
  tickmap: any;
  ticks: Map<number, Tick>;
  tickAddresses: PublicKey[];
}> {
  const [pool, tokenXProgram, tokenYProgram] = await Promise.all([
    market.getPool(pair),
    getTokenProgramAddress(connection, pair.tokenX),
    getTokenProgramAddress(connection, pair.tokenY)
  ]);
  const tickmap = await market.getTickmap(pair, pool);
  const startTickIndex = pool.currentTickIndex;
  const amountLimit = TICK_CROSSES_PER_IX;
  const amountLimitBackward = 1;
  const amountLimitForward = amountLimit - amountLimitBackward;
  const priceDirection = xToY ? 'down' : 'up';
  const oppositePriceDirection = xToY ? 'up' : 'down';
  const rangeLimitForward = TICK_SEARCH_RANGE * (TICK_VIRTUAL_CROSSES_PER_IX + amountLimitForward);
  const rangeLimitBackward = TICK_SEARCH_RANGE * amountLimitBackward;
  const tickIndexesForward = findClosestTicks(
    tickmap.bitmap,
    startTickIndex,
    pool.tickSpacing,
    amountLimitForward,
    rangeLimitForward,
    priceDirection
  );
  const tickIndexesBackwards = findClosestTicks(
    tickmap.bitmap,
    startTickIndex + (xToY ? pool.tickSpacing : -pool.tickSpacing),
    pool.tickSpacing,
    amountLimitBackward,
    rangeLimitBackward,
    oppositePriceDirection
  );
  const tickIndexes = tickIndexesForward.concat(tickIndexesBackwards);
  const tickAddresses = tickIndexes.map((t) => market.getTickAddress(pair, t).tickAddress);
  const tickAccounts = await market.program.account.tick.fetchMultiple(tickAddresses);
  if (tickAccounts.find((v) => v === null)) {throw new Error('Tick accounts need to be fetched again');}
  const ticks = new Map<number, Tick>();
  tickAccounts.forEach((v) => {if (v) {let tick = v as Tick; ticks.set(tick.index, tick);}});
  return {pool, tokenXProgram, tokenYProgram, tickmap, ticks, tickAddresses};
}

export async function executeOptimizedSwap(
  market: Market,
  pair: Pair,
  owner: Keypair,
  accountX: PublicKey,
  accountY: PublicKey,
  amount: BN,
  xToY: boolean,
  byAmountIn: boolean,
  slippage: Decimal,
  connection: Connection,
  referralAccount?: PublicKey
): Promise<string> {
  const {pool, tokenXProgram, tokenYProgram, tickmap, ticks} = await queryOptimalTicks(market, pair, xToY, connection);
  const amountLimit = TICK_CROSSES_PER_IX;
  const amountLimitBackward = 1;
  const amountLimitForward = amountLimit - amountLimitBackward;
  const simulation = simulateSwap({tickmap, xToY, byAmountIn, swapAmount: amount, slippage, ticks, pool, maxCrosses: amountLimitForward});
  const txHash = await market.swap(
    {
      pair,
      xToY,
      slippage,
      estimatedPriceAfterSwap: simulation.priceAfterSwap,
      amount,
      byAmountIn,
      owner: owner.publicKey,
      accountX,
      accountY,
      referralAccount
    },
    owner
  );
  return txHash;
}