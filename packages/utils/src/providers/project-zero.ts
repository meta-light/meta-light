import {
  type Amount,
  AssetTag,
  type Bank,
  getAssetQuantity,
  getConfig,
  getLiabilityQuantity,
  MarginfiAccount,
  type MarginfiAccountWrapper,
  MarginRequirementType,
  type OraclePrice,
  Project0Client,
  simulateAccountHealthCacheWithFallback,
  simulateBundle,
  fetchOracleData,
  USDC_MINT,
  WSOL_MINT,
} from '@0dotxyz/p0-ts-sdk';
import {
  Connection,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from '@solana/web3.js';

export { USDC_MINT, WSOL_MINT };

export type Project0Env = Parameters<typeof getConfig>[0];

export interface Project0 {
  client: Project0Client;
  connection: Connection;
  rpcUrl: string;
}

export interface LoadedAccount {
  account: MarginfiAccount;
  wrapper: MarginfiAccountWrapper;
}

export interface HealthSummary {
  assets: number;
  liabilities: number;
  health: number;
}

export interface AccountMetrics {
  initial: HealthSummary;
  maintenance: HealthSummary;
  equity: HealthSummary;
  freeCollateral: number;
  accountValue: number;
  netApy: number;
}

export interface BalanceView {
  bank: string;
  mint: string;
  assetTag: AssetTag;
  deposits: number;
  borrows: number;
  price: number | null;
}

export async function createProject0Client(
  rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  env: Project0Env = 'production',
): Promise<Project0> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const client = await Project0Client.initialize(connection, getConfig(env));
  return { client, connection, rpcUrl };
}

export async function loadAccount(
  client: Project0Client,
  address: PublicKey | string,
): Promise<LoadedAccount> {
  const wrapper = await client.fetchAccount(new PublicKey(address));
  const account = await MarginfiAccount.fetch(wrapper.address, client.program);
  return { account, wrapper };
}

export function getAccountAddresses(
  client: Project0Client,
  authority: PublicKey | string,
): Promise<PublicKey[]> {
  return client.getAccountAddresses(new PublicKey(authority));
}

export function findBank(
  client: Project0Client,
  mint: PublicKey | string,
  assetTag?: AssetTag,
): Bank {
  const [bank] = client.getBanksByMint(new PublicKey(mint), assetTag);
  if (!bank) throw new Error(`No Project0 bank for mint ${mint.toString()}`);
  return bank;
}

function marketParams(client: Project0Client) {
  return {
    banksMap: client.bankMap,
    oraclePricesByBank: client.oraclePriceByBank,
    assetShareValueMultiplierByBank: client.assetShareValueMultiplierByBank,
  };
}

function toHealth(assets: number, liabilities: number): HealthSummary {
  return {
    assets,
    liabilities,
    health: assets === 0 ? 0 : (assets - liabilities) / assets,
  };
}

export function healthFromCache(
  account: MarginfiAccount,
  requirement = MarginRequirementType.Maintenance,
): HealthSummary {
  const { assets, liabilities } =
    account.computeHealthComponentsFromCache(requirement);
  return toHealth(assets.toNumber(), liabilities.toNumber());
}

export function healthFromBalances(
  client: Project0Client,
  account: MarginfiAccount,
  requirement = MarginRequirementType.Maintenance,
): HealthSummary {
  const { assets, liabilities } = account.computeHealthComponentsFromBalances({
    ...marketParams(client),
    marginRequirement: requirement,
  });
  return toHealth(assets.toNumber(), liabilities.toNumber());
}

export function accountMetrics(
  client: Project0Client,
  account: MarginfiAccount,
): AccountMetrics {
  const params = marketParams(client);
  return {
    initial: healthFromBalances(client, account, MarginRequirementType.Initial),
    maintenance: healthFromBalances(
      client,
      account,
      MarginRequirementType.Maintenance,
    ),
    equity: healthFromBalances(client, account, MarginRequirementType.Equity),
    freeCollateral: account.computeFreeCollateralFromBalances(params).toNumber(),
    accountValue: account.computeAccountValue().toNumber(),
    netApy: account.computeNetApy(params),
  };
}

export async function simulateHealth(
  client: Project0Client,
  account: MarginfiAccount,
): Promise<MarginfiAccount> {
  const { marginfiAccount, error } =
    await simulateAccountHealthCacheWithFallback({
      ...marketParams(client),
      program: client.program,
      marginfiAccount: account,
      bankIntegrationMap: client.bankIntegrationMap,
    });
  if (error) throw error;
  return MarginfiAccount.fromAccountType(marginfiAccount);
}

export function getOraclePrices(client: Project0Client): Map<string, OraclePrice> {
  return client.oraclePriceByBank;
}

export async function refreshOraclePrices(
  client: Project0Client,
  connection: Connection,
) {
  return fetchOracleData(client.banks, {
    pythOpts: { mode: 'on-chain', connection },
    swbOpts: { mode: 'on-chain', connection },
  });
}

export function listBalances(
  client: Project0Client,
  account: MarginfiAccount,
): BalanceView[] {
  return account.balances
    .filter((b) => b.active)
    .flatMap((b) => {
      const key = b.bankPk.toBase58();
      const bank = client.bankMap.get(key);
      if (!bank) return [];
      const scale = 10 ** bank.mintDecimals;
      return [
        {
          bank: key,
          mint: bank.mint.toBase58(),
          assetTag: bank.config.assetTag,
          deposits: getAssetQuantity(bank, b.assetShares).toNumber() / scale,
          borrows:
            getLiabilityQuantity(bank, b.liabilityShares).toNumber() / scale,
          price:
            client.oraclePriceByBank.get(key)?.priceRealtime.price.toNumber() ??
            null,
        },
      ];
    });
}

export function maxBorrow(
  client: Project0Client,
  account: MarginfiAccount,
  bankAddress: PublicKey,
): number {
  return account
    .computeMaxBorrowForBank({ ...marketParams(client), bankAddress })
    .toNumber();
}

export function maxWithdraw(
  client: Project0Client,
  account: MarginfiAccount,
  bankAddress: PublicKey,
): number {
  return account
    .computeMaxWithdrawForBank({ ...marketParams(client), bankAddress })
    .toNumber();
}

export function buildDepositTx(
  wrapper: MarginfiAccountWrapper,
  bankAddress: PublicKey,
  amount: Amount,
) {
  return wrapper.makeDepositTx(bankAddress, amount);
}

export function buildBorrowTx(
  wrapper: MarginfiAccountWrapper,
  bankAddress: PublicKey,
  amount: Amount,
) {
  return wrapper.makeBorrowTx(bankAddress, amount);
}

export function buildRepayTx(
  wrapper: MarginfiAccountWrapper,
  bankAddress: PublicKey,
  amount: Amount,
  repayAll = false,
) {
  return wrapper.makeRepayTx(bankAddress, amount, repayAll);
}

export function buildWithdrawTx(
  client: Project0Client,
  wrapper: MarginfiAccountWrapper,
  bankAddress: PublicKey,
  amount: Amount,
  withdrawAll = false,
) {
  const bank = client.getBank(bankAddress);
  if (!bank) throw new Error(`Unknown bank ${bankAddress.toBase58()}`);
  switch (bank.config.assetTag) {
    case AssetTag.DEFAULT:
    case AssetTag.SOL:
      return wrapper.makeWithdrawTx(bankAddress, amount, withdrawAll);
    case AssetTag.KAMINO: {
      const reserve =
        client.bankIntegrationMap[bankAddress.toBase58()]?.kaminoStates
          ?.reserveState;
      if (!reserve)
        throw new Error(`No Kamino reserve for ${bankAddress.toBase58()}`);
      return wrapper.makeKaminoWithdrawTx(
        bankAddress,
        amount,
        reserve,
        withdrawAll,
      );
    }
    default:
      throw new Error(`Unsupported asset tag ${bank.config.assetTag}`);
  }
}

export async function simulateTx(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey,
) {
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;
  return connection.simulateTransaction(tx);
}

export function simulateTxBundle(
  rpcUrl: string,
  transactions: (Transaction | VersionedTransaction)[],
) {
  return simulateBundle(rpcUrl, transactions);
}
