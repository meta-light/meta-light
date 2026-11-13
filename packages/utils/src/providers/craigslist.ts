// Craigslist rental search client, saved from the old backend rentals service
// (spun down). Not wired to anything. Search criteria come from the
// RENTALS_CRITERIA env var (JSON) unless passed explicitly.

export interface IRentalListing {
  id: string;
  source: 'craigslist';
  criteriaKey: string;
  criteriaName: string;
  listingId: string;
  title: string;
  url: string;
  searchUrl: string;
  areaUrl: string;
  searchPath: string;
  locationText?: string;
  price?: number;
  priceText?: string;
  bedrooms?: number;
  squareFeet?: number;
  latitude?: number;
  longitude?: number;
  postedAt: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  notifiedAt?: Date;
  status: 'active' | 'inactive';
  imageIds: string[];
  raw?: unknown[];
}

export interface CraigslistRentalCriteria {
  name: string;
  batch: string;
  searchPath: string;
  lang?: string;
  countryCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  petsCat?: boolean;
  petsDog?: boolean;
  sort?: 'date';
  allowedLocationKeywords?: string[];
  blockedLocationKeywords?: string[];
  requiredTitleKeywords?: string[];
  extraParams?: Record<string, string | number | boolean | undefined>;
}

export interface RentalLocationFilterConfig {
  allowlist: string[];
  blocklist: string[];
}

export const craigslistApiConfig = {
  baseUrl: 'https://sapi.craigslist.org/web/v8/postings/search/full',
  requestTimeoutMs: 15000,
  userAgent: 'carpcap-rentals-service/1.0',
};

export const defaultCraigslistRentalCriteria: CraigslistRentalCriteria =
  loadRentalCriteria();

export const rentalsLocationFilterConfig: RentalLocationFilterConfig = {
  allowlist: parseKeywordList(process.env.RENTALS_LOCATION_ALLOWLIST),
  blocklist: parseKeywordList(process.env.RENTALS_LOCATION_BLOCKLIST),
};

export const rentalsNotificationConfig = {
  scheduleTimeZone: 'America/New_York',
  lookbackHours: parsePositiveInt(process.env.RENTALS_NOTIFICATION_LOOKBACK_HOURS, 36),
};

export function buildCriteriaKey(criteria: CraigslistRentalCriteria): string {
  return criteria.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveRentalLocationFilter(
  criteria: CraigslistRentalCriteria,
): RentalLocationFilterConfig {
  return {
    allowlist: dedupeKeywords([
      ...(criteria.allowedLocationKeywords || []),
      ...rentalsLocationFilterConfig.allowlist,
    ]),
    blocklist: dedupeKeywords([
      ...(criteria.blockedLocationKeywords || []),
      ...rentalsLocationFilterConfig.blocklist,
    ]),
  };
}

function loadRentalCriteria(): CraigslistRentalCriteria {
  const raw = process.env.RENTALS_CRITERIA;
  if (!raw) {
    return { name: 'unset', batch: '', searchPath: '' };
  }
  return JSON.parse(raw) as CraigslistRentalCriteria;
}

function parseKeywordList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return dedupeKeywords(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function dedupeKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

interface CraigslistDecodeData {
  locationDescriptions?: Array<string | number>;
  minPostedDate?: number;
  minPostingId?: number;
}

interface CraigslistLocation {
  url: string;
}

interface CraigslistSearchData {
  canonicalUrl?: string;
  decode: CraigslistDecodeData;
  items: unknown[][];
  location: CraigslistLocation;
  totalResultCount?: number;
}

interface CraigslistSearchResponse {
  data: CraigslistSearchData;
  errors?: unknown[];
}

export interface CraigslistRentalListing {
  source: 'craigslist';
  criteriaKey: string;
  criteriaName: string;
  listingId: string;
  title: string;
  url: string;
  searchUrl: string;
  areaUrl: string;
  searchPath: string;
  locationText?: string;
  price?: number;
  priceText?: string;
  bedrooms?: number;
  squareFeet?: number;
  latitude?: number;
  longitude?: number;
  postedAt: Date;
  imageIds: string[];
  raw: unknown[];
}

export function buildCraigslistSearchUrl(
  criteria: CraigslistRentalCriteria = defaultCraigslistRentalCriteria,
): string {
  const url = new URL(craigslistApiConfig.baseUrl);
  const params = url.searchParams;
  params.set('batch', criteria.batch);
  params.set('searchPath', criteria.searchPath);
  params.set('lang', criteria.lang || 'en');
  params.set('cc', criteria.countryCode || 'us');
  if (criteria.sort) {
    params.set('sort', criteria.sort);
  }
  if (criteria.minPrice != null) {
    params.set('min_price', String(criteria.minPrice));
  }
  if (criteria.maxPrice != null) {
    params.set('max_price', String(criteria.maxPrice));
  }
  if (criteria.minBedrooms != null) {
    params.set('min_bedrooms', String(criteria.minBedrooms));
  }
  if (criteria.maxBedrooms != null) {
    params.set('max_bedrooms', String(criteria.maxBedrooms));
  }
  if (criteria.minBathrooms != null) {
    params.set('min_bathrooms', String(criteria.minBathrooms));
  }
  if (criteria.maxBathrooms != null) {
    params.set('max_bathrooms', String(criteria.maxBathrooms));
  }
  if (criteria.petsCat) {
    params.set('pets_cat', '1');
  }
  if (criteria.petsDog) {
    params.set('pets_dog', '1');
  }
  for (const [key, value] of Object.entries(criteria.extraParams || {})) {
    if (value == null) {
      continue;
    }
    params.set(
      key,
      typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
    );
  }
  return url.toString();
}

export async function fetchCraigslistRentalListings(
  criteria: CraigslistRentalCriteria = defaultCraigslistRentalCriteria,
): Promise<CraigslistRentalListing[]> {
  const searchUrl = buildCraigslistSearchUrl(criteria);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    craigslistApiConfig.requestTimeoutMs,
  );
  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': craigslistApiConfig.userAgent,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Craigslist rentals request failed: ${response.status} ${body}`,
      );
    }
    const payload = (await response.json()) as CraigslistSearchResponse;
    if (!payload.data || !Array.isArray(payload.data.items)) {
      throw new Error('Craigslist rentals response did not include data.items');
    }
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new Error(
        `Craigslist rentals response returned errors: ${JSON.stringify(payload.errors)}`,
      );
    }
    return payload.data.items
      .map((item) =>
        decodeCraigslistRentalListing(item, payload.data, criteria, searchUrl),
      )
      .filter((item): item is CraigslistRentalListing => Boolean(item))
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  } finally {
    clearTimeout(timeout);
  }
}

function decodeCraigslistRentalListing(
  item: unknown[],
  data: CraigslistSearchData,
  criteria: CraigslistRentalCriteria,
  searchUrl: string,
): CraigslistRentalListing | null {
  const encodedPostingId = toNumber(item[0]);
  const encodedPostedAt = toNumber(item[1]);
  const title = typeof item[10] === 'string' ? item[10].trim() : '';
  if (encodedPostingId == null || encodedPostedAt == null || !title) {
    return null;
  }

  const minPostingId = data.decode.minPostingId || 0;
  const minPostedDate = data.decode.minPostedDate || 0;
  const listingId = String(minPostingId + encodedPostingId);
  const postedAt = new Date((minPostedDate + encodedPostedAt) * 1000);
  const price = toNumber(item[3]);
  const priceText = extractTupleString(item[9]);
  const slug = extractTupleString(item[8]);
  const imageIds = extractTupleStrings(item[7]);
  const housingInfo = Array.isArray(item[11]) ? item[11] : [];
  const bedrooms = toPositiveNumber(housingInfo[1]);
  const squareFeet = toPositiveNumber(housingInfo[2]);
  const geo = parseLocationValue(
    typeof item[4] === 'string' ? item[4] : undefined,
    data.decode.locationDescriptions,
  );
  const areaUrl = data.location?.url
    ? `https://${data.location.url}`
    : 'https://craigslist.org';
  const url = buildCraigslistListingUrl(
    areaUrl,
    criteria.searchPath,
    slug,
    listingId,
  );

  return {
    source: 'craigslist',
    criteriaKey: buildCriteriaKey(criteria),
    criteriaName: criteria.name,
    listingId,
    title,
    url,
    searchUrl,
    areaUrl,
    searchPath: criteria.searchPath,
    locationText: geo.locationText,
    price: price ?? undefined,
    priceText,
    bedrooms,
    squareFeet,
    latitude: geo.latitude,
    longitude: geo.longitude,
    postedAt,
    imageIds,
    raw: item,
  };
}

function buildCraigslistListingUrl(
  areaUrl: string,
  searchPath: string,
  slug: string | undefined,
  listingId: string,
): string {
  const normalizedAreaUrl = areaUrl.replace(/\/+$/, '');
  const normalizedSearchPath = searchPath.replace(/^\/+|\/+$/g, '');
  if (slug) {
    return `${normalizedAreaUrl}/${normalizedSearchPath}/d/${slug}/${listingId}.html`;
  }
  return `${normalizedAreaUrl}/${normalizedSearchPath}/${listingId}.html`;
}

function parseLocationValue(
  value: string | undefined,
  locationDescriptions: Array<string | number> | undefined,
): { latitude?: number; longitude?: number; locationText?: string } {
  if (!value) {
    return {};
  }
  const parts = value.split('~');
  if (parts.length < 3) {
    return {};
  }
  const latitude = toNumber(parts[1]);
  const longitude = toNumber(parts[2]);
  const locationToken = parts[0]?.split(':')[1];
  const locationIndex = locationToken ? Number(locationToken) : NaN;
  const locationText =
    Number.isFinite(locationIndex) && Array.isArray(locationDescriptions)
      ? readLocationDescription(locationDescriptions, locationIndex)
      : undefined;
  return {
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    locationText,
  };
}

function readLocationDescription(
  values: Array<string | number>,
  index: number,
): string | undefined {
  const decoded = values[index];
  return typeof decoded === 'string' ? decoded : undefined;
}

function extractTupleString(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.find(
    (entry, index) => index > 0 && typeof entry === 'string',
  ) as string | undefined;
}

function extractTupleStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry, index) => index > 0 && typeof entry === 'string',
  ) as string[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = toNumber(value);
  if (parsed == null || parsed <= 0) {
    return undefined;
  }
  return parsed;
}
