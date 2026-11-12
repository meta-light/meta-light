import { and, eq } from 'drizzle-orm';
import { connectDatabase, getDb } from '../database/client';
import { portfolioStates, portfolioWallets } from './schema';

export interface PortfolioWalletRecord {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
}

export async function upsertPortfolioWallet(
  wallet: PortfolioWalletRecord,
): Promise<void> {
  await connectDatabase();
  await getDb()
    .insert(portfolioWallets)
    .values(wallet)
    .onConflictDoUpdate({
      target: [portfolioWallets.address, portfolioWallets.netuid],
      set: { name: wallet.name, subnetName: wallet.subnetName },
    });
}

export async function listPortfolioWallets(): Promise<PortfolioWalletRecord[]> {
  await connectDatabase();
  const rows = await getDb()
    .select({
      name: portfolioWallets.name,
      address: portfolioWallets.address,
      netuid: portfolioWallets.netuid,
      subnetName: portfolioWallets.subnetName,
    })
    .from(portfolioWallets);
  return rows;
}

export async function readPortfolioState<T>(
  key: string,
): Promise<T | undefined> {
  await connectDatabase();
  const [row] = await getDb()
    .select()
    .from(portfolioStates)
    .where(eq(portfolioStates.key, key))
    .limit(1);
  return (row?.lastSnapshot ?? undefined) as T | undefined;
}

export async function writePortfolioState(
  key: string,
  lastSnapshot: unknown,
): Promise<void> {
  await connectDatabase();
  await getDb()
    .insert(portfolioStates)
    .values({ key, lastSnapshot })
    .onConflictDoUpdate({
      target: portfolioStates.key,
      set: { lastSnapshot },
    });
}

export async function portfolioWalletExists(
  address: string,
  netuid: number,
): Promise<boolean> {
  await connectDatabase();
  const [row] = await getDb()
    .select({ address: portfolioWallets.address })
    .from(portfolioWallets)
    .where(
      and(
        eq(portfolioWallets.address, address),
        eq(portfolioWallets.netuid, netuid),
      ),
    )
    .limit(1);
  return Boolean(row);
}
