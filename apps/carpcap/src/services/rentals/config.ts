import { RENTALS_LOCATION_ALLOWLIST, RENTALS_LOCATION_BLOCKLIST, RENTALS_NOTIFICATION_LOOKBACK_HOURS } from '../../env';

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
  userAgent: 'carpcap-rentals-service/1.0'
};

export const defaultCraigslistRentalCriteria: CraigslistRentalCriteria = {
  name: 'boston-cat-friendly-2br',
  batch: '4-0-360-0-0',
  searchPath: 'gbs/apa',
  lang: 'en',
  countryCode: 'us',
  maxPrice: 3200,
  minBedrooms: 2,
  petsCat: false,
  sort: 'date',
  requiredTitleKeywords: [
    'aug 1',
    'august 1',
    '8/1',
    '08/01', 
    'august'
  ],
  allowedLocationKeywords: [
    'Cambridge',
    'Porter',
    'Harvard',
    'Somerville',
    'Central',
    'Davis',
    'Brighton',
    'Coolidge Corner',
    'Brookline',
    'Allston',
    'Kendall',
    'MIT',
    'Assembly',
    'Sullivan',
    'Union',
    'Longwood',
    'Fenway',
    'Boston'
  ]
};

export const rentalsLocationFilterConfig: RentalLocationFilterConfig = {
  allowlist: parseKeywordList(RENTALS_LOCATION_ALLOWLIST),
  blocklist: parseKeywordList(RENTALS_LOCATION_BLOCKLIST)
};

export const rentalsNotificationConfig = {
  scheduleTimeZone: 'America/New_York',
  lookbackHours: parsePositiveInt(RENTALS_NOTIFICATION_LOOKBACK_HOURS, 36)
};

export function buildCriteriaKey(criteria: CraigslistRentalCriteria): string {
  return criteria.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveRentalLocationFilter(criteria: CraigslistRentalCriteria): RentalLocationFilterConfig {
  return {
    allowlist: dedupeKeywords([...(criteria.allowedLocationKeywords || []), ...rentalsLocationFilterConfig.allowlist]),
    blocklist: dedupeKeywords([...(criteria.blockedLocationKeywords || []), ...rentalsLocationFilterConfig.blocklist])
  };
}

function parseKeywordList(value: string | undefined): string[] {
  if (!value) {return [];}
  return dedupeKeywords(value.split(',').map((entry) => entry.trim()).filter(Boolean));
}

function dedupeKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {continue;}
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {return fallback;}
  return Math.floor(parsed);
}
