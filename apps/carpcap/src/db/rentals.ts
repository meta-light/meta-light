import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { IRentalListing } from '../services/rentals/model';
import { connectDatabase, getDb } from './client';
import { rentalListings } from './schema';

type RentalRow = typeof rentalListings.$inferSelect;

function toRental(row: RentalRow): IRentalListing {
  return {
    id: row.id,
    source: 'craigslist',
    criteriaKey: row.criteriaKey,
    criteriaName: row.criteriaName,
    listingId: row.listingId,
    title: row.title,
    url: row.url,
    searchUrl: row.searchUrl,
    areaUrl: row.areaUrl,
    searchPath: row.searchPath,
    locationText: row.locationText ?? undefined,
    price: row.price ?? undefined,
    priceText: row.priceText ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
    squareFeet: row.squareFeet ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    postedAt: row.postedAt,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    notifiedAt: row.notifiedAt ?? undefined,
    status: row.status as IRentalListing['status'],
    imageIds: row.imageIds ?? [],
    raw: (row.raw as unknown[] | null) ?? undefined,
  };
}

function rentalValues(listing: IRentalListing) {
  return {
    criteriaName: listing.criteriaName,
    title: listing.title,
    url: listing.url,
    searchUrl: listing.searchUrl,
    areaUrl: listing.areaUrl,
    searchPath: listing.searchPath,
    locationText: listing.locationText,
    price: listing.price,
    priceText: listing.priceText,
    bedrooms: listing.bedrooms,
    squareFeet: listing.squareFeet,
    latitude: listing.latitude,
    longitude: listing.longitude,
    postedAt: listing.postedAt,
    lastSeenAt: listing.lastSeenAt,
    status: listing.status,
    imageIds: listing.imageIds ?? [],
    raw: listing.raw,
    updatedAt: new Date(),
  };
}

export async function findRental(source: string, criteriaKey: string, listingId: string): Promise<IRentalListing | null> {
  await connectDatabase();
  const [row] = await getDb().select().from(rentalListings).where(and(
    eq(rentalListings.source, source),
    eq(rentalListings.criteriaKey, criteriaKey),
    eq(rentalListings.listingId, listingId),
  )).limit(1);
  return row ? toRental(row) : null;
}

export async function insertRental(listing: Omit<IRentalListing, 'id'>): Promise<IRentalListing> {
  await connectDatabase();
  const [row] = await getDb().insert(rentalListings).values({
    source: listing.source,
    criteriaKey: listing.criteriaKey,
    listingId: listing.listingId,
    firstSeenAt: listing.firstSeenAt,
    notifiedAt: listing.notifiedAt,
    ...rentalValues({ ...listing, id: '' }),
  }).returning();
  return toRental(row);
}

export async function saveRental(listing: IRentalListing): Promise<void> {
  await connectDatabase();
  await getDb().update(rentalListings).set(rentalValues(listing)).where(eq(rentalListings.id, listing.id));
}

export async function deactivateUnseenRentals(criteriaKey: string, seenBefore: Date): Promise<void> {
  await connectDatabase();
  await getDb().update(rentalListings).set({ status: 'inactive', updatedAt: new Date() }).where(and(
    eq(rentalListings.source, 'craigslist'),
    eq(rentalListings.criteriaKey, criteriaKey),
    lt(rentalListings.lastSeenAt, seenBefore),
  ));
}

export async function countActiveRentals(criteriaKey: string): Promise<number> {
  await connectDatabase();
  const [row] = await getDb().select({ count: sql<number>`count(*)` }).from(rentalListings).where(and(
    eq(rentalListings.source, 'craigslist'),
    eq(rentalListings.criteriaKey, criteriaKey),
    eq(rentalListings.status, 'active'),
  ));
  return Number(row?.count ?? 0);
}

export async function listRentals(options: { criteriaKey?: string; status?: 'active' | 'inactive' | 'all'; limit: number }): Promise<IRentalListing[]> {
  await connectDatabase();
  const filters = [];
  if (options.criteriaKey) filters.push(eq(rentalListings.criteriaKey, options.criteriaKey));
  if (options.status && options.status !== 'all') filters.push(eq(rentalListings.status, options.status));
  const rows = await getDb().select().from(rentalListings)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(rentalListings.postedAt))
    .limit(options.limit);
  return rows.map(toRental);
}

export async function listPendingRentals(criteriaKey: string, earliestFirstSeenAt: Date): Promise<IRentalListing[]> {
  await connectDatabase();
  const rows = await getDb().select().from(rentalListings).where(and(
    eq(rentalListings.source, 'craigslist'),
    eq(rentalListings.criteriaKey, criteriaKey),
    eq(rentalListings.status, 'active'),
    gte(rentalListings.firstSeenAt, earliestFirstSeenAt),
    isNull(rentalListings.notifiedAt),
  )).orderBy(desc(rentalListings.postedAt), desc(rentalListings.firstSeenAt)).limit(25);
  return rows.map(toRental);
}

export async function markRentalsNotified(ids: string[], notifiedAt: Date): Promise<void> {
  if (ids.length === 0) return;
  await connectDatabase();
  await getDb().update(rentalListings).set({ notifiedAt, updatedAt: new Date() }).where(inArray(rentalListings.id, ids));
}
