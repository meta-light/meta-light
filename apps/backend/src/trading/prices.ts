import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { PriceEntry } from './models/price';
import { connectDatabase, getDb } from '../database/client';
import { prices } from './schema';

type PriceRow = typeof prices.$inferSelect;

function toPrice(row: PriceRow): PriceEntry {
  return {
    _id: row.id,
    timestamp: row.timestamp,
    token: row.token,
    address: row.address,
    price: row.price,
    source: row.source as PriceEntry['source'],
    chain: row.chain as PriceEntry['chain'],
    confidenceLevel: row.confidenceLevel as PriceEntry['confidenceLevel'],
    bidAskSpread: row.bidAskSpread ?? undefined,
    spreadPercentage: row.spreadPercentage ?? undefined,
    liquidityScore: row.liquidityScore ?? undefined,
    priceImpact10: row.priceImpact10 ?? undefined,
    priceImpact100: row.priceImpact100 ?? undefined,
    priceImpact1000: row.priceImpact1000 ?? undefined,
    isLiquid: row.isLiquid ?? undefined,
    isStale: row.isStale ?? undefined,
    lastSwapAge: row.lastSwapAge ?? undefined,
    extraInfo: (row.extraInfo ?? undefined) as PriceEntry['extraInfo'],
  };
}

export async function insertPrices(
  rows: Omit<PriceEntry, '_id'>[],
): Promise<void> {
  if (rows.length === 0) return;
  await connectDatabase();
  const mapped = rows.map((row) => ({
    timestamp: row.timestamp,
    token: row.token,
    address: row.address,
    price: row.price,
    source: row.source,
    chain: row.chain,
    confidenceLevel: row.confidenceLevel,
    bidAskSpread: row.bidAskSpread,
    spreadPercentage: row.spreadPercentage,
    liquidityScore: row.liquidityScore,
    priceImpact10: row.priceImpact10,
    priceImpact100: row.priceImpact100,
    priceImpact1000: row.priceImpact1000,
    isLiquid: row.isLiquid,
    isStale: row.isStale,
    lastSwapAge: row.lastSwapAge,
    extraInfo: row.extraInfo,
  }));
  // D1 allows 100 bound parameters per query. A price row uses about 18.
  for (let offset = 0; offset < mapped.length; offset += 5) {
    await getDb()
      .insert(prices)
      .values(mapped.slice(offset, offset + 5));
  }
}

export async function latestPrice(
  token: string,
  chain: string,
): Promise<PriceEntry | null> {
  await connectDatabase();
  const [row] = await getDb()
    .select()
    .from(prices)
    .where(and(eq(prices.token, token), eq(prices.chain, chain)))
    .orderBy(desc(prices.timestamp))
    .limit(1);
  return row ? toPrice(row) : null;
}

export async function priceHistory(
  token: string,
  chain: string,
  limit: number,
): Promise<PriceEntry[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(prices)
    .where(and(eq(prices.token, token), eq(prices.chain, chain)))
    .orderBy(desc(prices.timestamp))
    .limit(limit);
  return rows.map(toPrice);
}

export async function findPricesByChainRange(
  chain: string,
  start: Date,
  end: Date,
): Promise<PriceEntry[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(prices)
    .where(
      and(
        eq(prices.chain, chain),
        gte(prices.timestamp, start),
        lte(prices.timestamp, end),
      ),
    )
    .orderBy(asc(prices.timestamp));
  return rows.map(toPrice);
}
