import { FilterQuery } from 'mongoose';
import { CraigslistRentalCriteria, buildCriteriaKey, defaultCraigslistRentalCriteria, rentalsNotificationConfig, resolveRentalLocationFilter } from './config';
import { CraigslistRentalListing, fetchCraigslistRentalListings, buildCraigslistSearchUrl } from './fetcher';
import { IRentalListing, RentalListingModel } from './model';
import { sendRentalListingNotifications } from './telegram';

export interface RentalSyncResult {
  criteriaKey: string;
  searchUrl: string;
  fetched: number;
  matched: number;
  filteredOut: number;
  created: number;
  active: number;
  newListings: IRentalListing[];
}

export interface RentalListingQueryOptions {
  criteriaKey?: string;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
}

export interface RentalNotificationResult {
  criteriaKey: string;
  pending: number;
  notified: number;
  sync: RentalSyncResult;
}

export async function syncCraigslistRentals(criteria: CraigslistRentalCriteria = defaultCraigslistRentalCriteria): Promise<RentalSyncResult> {
  const criteriaKey = buildCriteriaKey(criteria);
  const listings = await fetchCraigslistRentalListings(criteria);
  const dedupedListings = dedupeListings(listings);
  const matchedListings = filterListings(dedupedListings, criteria);
  const syncStartedAt = new Date();
  const newListings: IRentalListing[] = [];

  for (const listing of matchedListings) {
    const query = { source: listing.source, criteriaKey, listingId: listing.listingId };
    const existing = await RentalListingModel.findOne(query);
    if (existing) {
      applyListing(existing, listing, syncStartedAt);
      await existing.save();
      continue;
    }
    const created = await RentalListingModel.create({
      ...listing,
      firstSeenAt: syncStartedAt,
      lastSeenAt: syncStartedAt,
      status: 'active'
    });
    newListings.push(created);
  }

  await RentalListingModel.updateMany(
    {
      source: 'craigslist',
      criteriaKey,
      lastSeenAt: { $lt: syncStartedAt }
    },
    {
      $set: { status: 'inactive' }
    }
  );

  const active = await RentalListingModel.countDocuments({ source: 'craigslist', criteriaKey, status: 'active' });
  return {
    criteriaKey,
    searchUrl: buildCraigslistSearchUrl(criteria),
    fetched: listings.length,
    matched: matchedListings.length,
    filteredOut: dedupedListings.length - matchedListings.length,
    created: newListings.length,
    active,
    newListings
  };
}

export async function getRentalListings(options: RentalListingQueryOptions = {}): Promise<IRentalListing[]> {
  const query: FilterQuery<IRentalListing> = {};
  if (options.criteriaKey) {query.criteriaKey = options.criteriaKey;}
  if (options.status && options.status !== 'all') {query.status = options.status;}
  const limit = Math.min(Math.max(options.limit || 20, 1), 500);
  return RentalListingModel.find(query).sort({ postedAt: -1 }).limit(limit);
}

export async function runRentalsTask(criteria: CraigslistRentalCriteria = defaultCraigslistRentalCriteria): Promise<RentalSyncResult> {
  const result = await syncCraigslistRentals(criteria);
  console.log(`[rentals] criteria=${result.criteriaKey} fetched=${result.fetched} matched=${result.matched} filtered=${result.filteredOut} new=${result.created} active=${result.active}`);
  return result;
}

export async function runRentalsNotificationTask(criteria: CraigslistRentalCriteria = defaultCraigslistRentalCriteria): Promise<RentalNotificationResult> {
  const sync = await syncCraigslistRentals(criteria);
  const pendingListings = await getPendingRentalNotifications(criteria);
  const notifiedListingIds = await sendRentalListingNotifications(pendingListings, criteria.name);
  if (notifiedListingIds.length > 0) {
    await RentalListingModel.updateMany(
      { _id: { $in: notifiedListingIds } },
      { $set: { notifiedAt: new Date() } }
    );
  }
  console.log(`[rentals] criteria=${sync.criteriaKey} fetched=${sync.fetched} matched=${sync.matched} filtered=${sync.filteredOut} new=${sync.created} pending=${pendingListings.length} notified=${notifiedListingIds.length} active=${sync.active}`);
  return {
    criteriaKey: sync.criteriaKey,
    pending: pendingListings.length,
    notified: notifiedListingIds.length,
    sync
  };
}

function dedupeListings(listings: CraigslistRentalListing[]): CraigslistRentalListing[] {
  const seenListingIds = new Set<string>();
  return listings.filter((listing) => {
    if (seenListingIds.has(listing.listingId)) {return false;}
    seenListingIds.add(listing.listingId);
    return true;
  });
}

function applyListing(existing: IRentalListing, listing: CraigslistRentalListing, seenAt: Date): void {
  existing.criteriaName = listing.criteriaName;
  existing.title = listing.title;
  existing.url = listing.url;
  existing.searchUrl = listing.searchUrl;
  existing.areaUrl = listing.areaUrl;
  existing.searchPath = listing.searchPath;
  existing.locationText = listing.locationText;
  existing.price = listing.price;
  existing.priceText = listing.priceText;
  existing.bedrooms = listing.bedrooms;
  existing.squareFeet = listing.squareFeet;
  existing.latitude = listing.latitude;
  existing.longitude = listing.longitude;
  existing.postedAt = listing.postedAt;
  existing.imageIds = listing.imageIds;
  existing.raw = listing.raw;
  existing.lastSeenAt = seenAt;
  existing.status = 'active';
}

async function getPendingRentalNotifications(criteria: CraigslistRentalCriteria): Promise<IRentalListing[]> {
  const criteriaKey = buildCriteriaKey(criteria);
  const earliestFirstSeenAt = new Date(Date.now() - rentalsNotificationConfig.lookbackHours * 60 * 60 * 1000);
  return RentalListingModel.find({
    source: 'craigslist',
    criteriaKey,
    status: 'active',
    firstSeenAt: { $gte: earliestFirstSeenAt },
    $or: [
      { notifiedAt: { $exists: false } },
      { notifiedAt: null }
    ]
  })
    .sort({ postedAt: -1, firstSeenAt: -1 })
    .limit(25);
}

function filterListings(listings: CraigslistRentalListing[], criteria: CraigslistRentalCriteria): CraigslistRentalListing[] {
  const requiredTitleKeywords = criteria.requiredTitleKeywords || [];
  const filter = resolveRentalLocationFilter(criteria);
  if (requiredTitleKeywords.length === 0 && filter.allowlist.length === 0 && filter.blocklist.length === 0) {return listings;}
  return listings.filter((listing) => matchesTitleFilter(listing, requiredTitleKeywords) && matchesLocationFilter(listing, filter));
}

function matchesTitleFilter(listing: CraigslistRentalListing, requiredTitleKeywords: string[]): boolean {
  if (requiredTitleKeywords.length === 0) {return true;}
  const normalizedTitle = normalizeFilterText(listing.title);
  if (!normalizedTitle) {return false;}
  return requiredTitleKeywords.some((keyword) => matchesKeyword(keyword, [normalizedTitle]));
}

function matchesLocationFilter(
  listing: CraigslistRentalListing,
  filter: { allowlist: string[]; blocklist: string[] }
): boolean {
  const haystacks = [listing.locationText, listing.title]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeFilterText);
  if (haystacks.length === 0) {return filter.allowlist.length === 0;}
  if (filter.blocklist.some((keyword) => matchesKeyword(keyword, haystacks))) {return false;}
  if (filter.allowlist.length === 0) {return true;}
  return filter.allowlist.some((keyword) => matchesKeyword(keyword, haystacks));
}

function matchesKeyword(keyword: string, haystacks: string[]): boolean {
  const normalizedKeyword = normalizeFilterText(keyword);
  if (!normalizedKeyword) {return false;}
  return haystacks.some((text) => text.includes(normalizedKeyword));
}

function normalizeFilterText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export { buildCriteriaKey, defaultCraigslistRentalCriteria } from './config';
export { buildCraigslistSearchUrl, fetchCraigslistRentalListings } from './fetcher';
export { IRentalListing, RentalListingModel } from './model';
