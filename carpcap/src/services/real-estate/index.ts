import axios from 'axios';
import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { apiConfig, defaultSearchCriteria } from './config';
import { Property, SearchCriteria, FilteredProperty } from './Property';
import { calculateDistance } from './utils';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface AmenitySearchResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  category: string;
}

interface ParsedAmenityTag {
  key: string;
  value: string;
}

interface RealtorListingCandidate {
  listingUrl: string;
  status?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  propertyType?: string;
  imageUrl?: string;
  listingType?: 'FSBO' | 'Agent';
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC'
};

export class PropertyService {
  async getProperties(state?: string, city?: string, limit = apiConfig.defaultPropertyLimit): Promise<Property[]> {
    if (apiConfig.useCustomData) {return this.loadCustomData(state, city, limit);}
    const liveListings = await this.fetchFromRealtor(state, city, limit);
    if (liveListings.length > 0) {return liveListings;}
    if (apiConfig.fallbackToCustomDataOnError) {return this.loadCustomData(state, city, limit);}
    return [];
  }

  async searchProperties(criteria: SearchCriteria = defaultSearchCriteria): Promise<FilteredProperty[]> {
    const fallbackState = criteria.states[0];
    const properties = await this.getProperties(fallbackState, undefined, apiConfig.defaultPropertyLimit);
    return new PropertyFilter(criteria).filterProperties(properties);
  }

  private async fetchFromRealtor(state?: string, city?: string, limit = apiConfig.defaultPropertyLimit): Promise<Property[]> {
    const searchUrls = this.buildRealtorSearchUrls(state, city);
    const failures: string[] = [];
    for (const searchUrl of searchUrls) {
      try {
        const response = await axios.get<string>(searchUrl, {
          timeout: apiConfig.requestTimeoutMs,
          responseType: 'text',
          headers: {
            'User-Agent': apiConfig.userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://www.realtor.com/',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        const listings = this.parseRealtorSearchPage(response.data, state, city);
        if (listings.length > 0) {return listings.slice(0, limit);}
        failures.push(`parsed 0 listings from ${searchUrl}`);
      }
      catch (error) {
        failures.push(`${searchUrl} => ${this.errorMessage(error)}`);
      }
    }
    console.warn('Error fetching for-sale listings:', failures.join(' | '));
    return [];
  }

  private parseRealtorSearchPage(html: string, fallbackState?: string, fallbackCity?: string): Property[] {
    const $ = load(html);
    const results: Property[] = [];
    const seenUrls = new Set<string>();
    const normalizedState = this.normalizeState(fallbackState);
    $('a[href*="/realestateandhomes-detail/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) {return;}
      const listingUrl = href.startsWith('http') ? href : `https://www.realtor.com${href}`;
      if (seenUrls.has(listingUrl)) {return;}
      seenUrls.add(listingUrl);
      const card = $(element).closest('article, li, section, div');
      const cardText = this.extractCardText($, card);
      if (this.isBlockedStatus(cardText)) {return;}
      const detailText = $(element).text().replace(/\s+/g, ' ').trim();
      const fullAddress = detailText.replace(/^Property detail for\s+/i, '').trim();
      const parsedAddress = this.parseAddressComponents(fullAddress, normalizedState, fallbackCity);
      const price = this.parseFirstCurrency(cardText);
      if (!price || price <= 0) {return;}
      const bedrooms = this.parseBedrooms(cardText) || 0;
      const bathrooms = this.parseBathrooms(cardText) || 0;
      const squareFeet = this.parseSquareFeet(cardText) || 0;
      const estimatedValue = Math.max(1, Math.round(price * 0.82));
      const purchasePrice = Math.max(1, Math.round(price * 0.72));
      const image = card.find('img').first().attr('src');
      results.push({
        id: `realtor-${this.hashToHex(listingUrl)}`,
        address: parsedAddress.address,
        city: parsedAddress.city,
        state: parsedAddress.state,
        zipCode: parsedAddress.zipCode,
        latitude: 0,
        longitude: 0,
        price,
        estimatedValue,
        purchaseDate: '2021-06-01',
        purchasePrice,
        listingType: /for sale by owner|by owner|fsbo/i.test(cardText) ? 'FSBO' : 'Agent',
        bedrooms,
        bathrooms,
        squareFeet,
        yearBuilt: this.parseYearBuilt(cardText) || 2000,
        propertyType: this.parsePropertyType(cardText),
        listingUrl,
        description: 'Active listing pulled from Realtor search results.',
        images: image ? [image] : []
      });
    });
    if (results.length > 0) {return results;}
    return this.parseRealtorEmbeddedData(html, fallbackState, fallbackCity);
  }

  private async loadCustomData(state?: string, city?: string, limit = apiConfig.defaultPropertyLimit): Promise<Property[]> {
    try {
      const filePath = resolve(process.cwd(), apiConfig.customDataPath);
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Property[];
      const normalizedState = this.normalizeState(state);
      const stateAndCityFiltered = parsed.filter(property => {
        if (normalizedState && property.state.toUpperCase() !== normalizedState) {return false;}
        if (city && !property.city.toLowerCase().includes(city.toLowerCase())) {return false;}
        return true;
      });
      return stateAndCityFiltered.slice(0, limit);
    }
    catch (error) {
      console.warn('Error loading custom property data:', this.errorMessage(error));
      return [];
    }
  }

  private buildRealtorSearchUrls(state?: string, city?: string): string[] {
    const normalizedState = this.normalizeState(state || 'CA');
    const defaultCity = apiConfig.realtorDefaultCityByState[normalizedState] || 'Los Angeles';
    const resolvedCity = (city || defaultCity).trim();
    const formattedCity = this.formatCityForRealtor(resolvedCity);
    const primary = `${apiConfig.realtorSearchBaseUrl}/${formattedCity}_${normalizedState}`;
    const alternatives = [
      `${primary}/pg-1`,
      `${primary}/sby-1`,
      `${apiConfig.realtorSearchBaseUrl}/${formattedCity},-${normalizedState}`,
      `${primary}?view=map`
    ];
    return [primary, ...alternatives];
  }

  private parseAddressComponents(fullAddress: string, fallbackState?: string, fallbackCity?: string): { address: string; city: string; state: string; zipCode: string; } {
    const cleaned = fullAddress.replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/^(.*)\s+([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    if (match) {
      return {
        address: match[1].trim(),
        city: match[2].trim(),
        state: this.normalizeState(match[3]),
        zipCode: match[4] || ''
      };
    }
    return {
      address: cleaned || 'Unknown Address',
      city: fallbackCity || '',
      state: this.normalizeState(fallbackState),
      zipCode: ''
    };
  }

  private parseFirstCurrency(input: string): number | null {
    const match = input.match(/\$([\d,]+)/);
    if (!match) {return null;}
    const parsed = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseBedrooms(input: string): number | null {
    const match = input.match(/(\d+(?:\.\d+)?)\s*bed/i);
    if (!match) {return null;}
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseBathrooms(input: string): number | null {
    const match = input.match(/(\d+(?:\.\d+)?)\+?\s*bath/i);
    if (!match) {return null;}
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseSquareFeet(input: string): number | null {
    const match = input.match(/([\d,]+)\s*sqft/i);
    if (!match) {return null;}
    const parsed = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseYearBuilt(input: string): number | null {
    const match = input.match(/built in\s*(\d{4})/i);
    if (!match) {return null;}
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed) || parsed < 1800 || parsed > new Date().getFullYear()) {return null;}
    return parsed;
  }

  private parsePropertyType(input: string): string {
    const match = input.match(/(house|condo|townhome|multi-family home|mobile home|farm|land|apartment)\s+for sale/i);
    if (!match) {return 'Residential';}
    const normalized = match[1].toLowerCase();
    if (normalized === 'house') {return 'Single Family';}
    if (normalized === 'townhome') {return 'Townhouse';}
    if (normalized === 'condo') {return 'Condo';}
    return match[1];
  }

  private extractCardText($: ReturnType<typeof load>, element: ReturnType<ReturnType<typeof load>>): string {
    let current = element;
    let best = current.text().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 5; i++) {
      const text = current.text().replace(/\s+/g, ' ').trim();
      if (/\$\d/.test(text) && /for sale/i.test(text)) {return text;}
      if (text.length > best.length) {best = text;}
      const parent = current.parent();
      if (!parent || parent.length === 0) {break;}
      current = parent;
    }
    return best;
  }

  private isBlockedStatus(text: string): boolean {
    const lower = text.toLowerCase();
    const blocked = ['pending', 'contingent', 'sold', 'off market', 'recently sold'];
    return blocked.some(word => lower.includes(word));
  }

  async findNearbyAmenities(latitude: number, longitude: number, type: string, radiusMiles: number): Promise<AmenitySearchResult[]> {
    const amenityTags = this.getAmenityTags(type);
    if (amenityTags.length === 0) {return [];}
    const radiusMeters = Math.max(1, Math.round(radiusMiles * 1609.34));
    const block = amenityTags.map(tag => (
      `node["${tag.key}"="${tag.value}"](around:${radiusMeters},${latitude},${longitude});
way["${tag.key}"="${tag.value}"](around:${radiusMeters},${latitude},${longitude});
relation["${tag.key}"="${tag.value}"](around:${radiusMeters},${latitude},${longitude});`
    )).join('\n');
    const query = `
      [out:json][timeout:${apiConfig.overpassTimeoutSeconds}];
      (
      ${block}
      );
      out center tags qt;
    `.trim();
    try {
      const response = await axios.get<OverpassResponse>(apiConfig.overpassApiUrl, {
        params: { data: query },
        timeout: apiConfig.requestTimeoutMs,
        headers: { 'User-Agent': apiConfig.userAgent }
      });
      if (!response.data?.elements?.length) {return [];}
      return response.data.elements
      .map((element): AmenitySearchResult | null => {
        const coords = this.getElementCoordinates(element);
        if (!coords) {return null;}
        return {
          id: `osm-${element.type}-${element.id}`,
          name: element.tags?.name || `${type} ${element.id}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          distanceMiles: calculateDistance(latitude, longitude, coords.latitude, coords.longitude),
          category: type
        };
      })
      .filter((amenity): amenity is AmenitySearchResult => Boolean(amenity))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    }
    catch (error) {
      console.warn('Error fetching nearby amenities from OpenStreetMap Overpass:', this.errorMessage(error));
      return [];
    }
  }

  private getAmenityTags(type: string): ParsedAmenityTag[] {
    const normalizedType = type.toLowerCase().trim();
    switch (normalizedType) {
      case 'school':
        return [{ key: 'amenity', value: 'school' }];
      case 'hospital':
        return [{ key: 'amenity', value: 'hospital' }];
      case 'shopping':
        return [{ key: 'shop', value: 'mall' }, { key: 'shop', value: 'supermarket' }];
      case 'restaurant':
        return [{ key: 'amenity', value: 'restaurant' }];
      case 'park':
        return [{ key: 'leisure', value: 'park' }];
      case 'gym':
        return [{ key: 'leisure', value: 'fitness_centre' }];
      case 'beach':
        return [{ key: 'natural', value: 'beach' }];
      case 'ski_resort':
      case 'ski area':
        return [{ key: 'piste:type', value: 'downhill' }, { key: 'landuse', value: 'winter_sports' }];
      case 'airport':
        return [{ key: 'aeroway', value: 'aerodrome' }];
      case 'train_station':
        return [{ key: 'railway', value: 'station' }];
      case 'highway':
        return [{ key: 'highway', value: 'motorway' }];
      case 'downtown':
        return [{ key: 'place', value: 'city' }, { key: 'place', value: 'town' }];
      default:
        return [];
    }
  }

  private getElementCoordinates(element: OverpassElement): { latitude: number; longitude: number; } | null {
    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
      return {
        latitude: element.lat,
        longitude: element.lon
      };
    }
    if (element.center) {
      return {
        latitude: element.center.lat,
        longitude: element.center.lon
      };
    }
    return null;
  }

  private normalizeState(state?: string): string {
    if (!state) {return '';}
    const trimmed = state.trim();
    if (trimmed.length === 2) {return trimmed.toUpperCase();}
    return STATE_ABBREVIATIONS[trimmed.toLowerCase()] || trimmed.toUpperCase();
  }

  private formatCityForRealtor(input: string): string {
    return input
    .trim()
    .replace(/[^a-zA-Z0-9\s-]+/g, '')
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  }

  private hashToHex(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  private errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url;
      if (status && url) {return `${status} ${url}`;}
      if (status) {return String(status);}
      return error.code || error.message;
    }
    if (error instanceof Error) {
      const singleLine = error.message.split('\n')[0]?.trim();
      return singleLine || error.message;
    }
    return 'Unknown error';
  }

  private parseRealtorEmbeddedData(html: string, fallbackState?: string, fallbackCity?: string): Property[] {
    const $ = load(html);
    const nextDataRaw = $('script#__NEXT_DATA__').html();
    if (!nextDataRaw) {return [];}
    let root: unknown;
    try {
      root = JSON.parse(nextDataRaw);
    }
    catch {
      return [];
    }
    const candidates = this.collectRealtorListingCandidates(root);
    if (candidates.length === 0) {return [];}
    const normalizedFallbackState = this.normalizeState(fallbackState);
    return candidates
    .filter(candidate => !candidate.status || !this.isBlockedStatus(candidate.status))
    .filter(candidate => Boolean(candidate.listingUrl && candidate.price && candidate.price > 0))
    .map(candidate => {
      const parsedAddress = this.parseAddressComponents(
        candidate.address || '',
        candidate.state || normalizedFallbackState,
        candidate.city || fallbackCity
      );
      const price = candidate.price || 0;
      return {
        id: `realtor-${this.hashToHex(candidate.listingUrl)}`,
        address: parsedAddress.address,
        city: candidate.city || parsedAddress.city,
        state: this.normalizeState(candidate.state || parsedAddress.state || normalizedFallbackState),
        zipCode: candidate.zipCode || parsedAddress.zipCode,
        latitude: 0,
        longitude: 0,
        price,
        estimatedValue: Math.max(1, Math.round(price * 0.82)),
        purchaseDate: '2021-06-01',
        purchasePrice: Math.max(1, Math.round(price * 0.72)),
        listingType: candidate.listingType || 'Agent',
        bedrooms: candidate.bedrooms || 0,
        bathrooms: candidate.bathrooms || 0,
        squareFeet: candidate.squareFeet || 0,
        yearBuilt: 2000,
        propertyType: candidate.propertyType || 'Residential',
        listingUrl: candidate.listingUrl,
        description: 'Active listing pulled from embedded Realtor search data.',
        images: candidate.imageUrl ? [candidate.imageUrl] : []
      } as Property;
    });
  }

  private collectRealtorListingCandidates(root: unknown): RealtorListingCandidate[] {
    const results: RealtorListingCandidate[] = [];
    const seen = new Set<string>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') {return;}
      if (Array.isArray(value)) {
        for (const item of value) {visit(item);}
        return;
      }
      const record = value as Record<string, unknown>;
      const permalink = typeof record.permalink === 'string' ? record.permalink : undefined;
      const listPrice = this.asNumber(record.list_price);
      if (permalink && listPrice && listPrice > 0) {
        const listingUrl = permalink.startsWith('http') ? permalink : `https://www.realtor.com${permalink}`;
        if (!seen.has(listingUrl)) {
          seen.add(listingUrl);
          const location = this.asRecord(record.location);
          const address = this.asRecord(location?.address);
          const description = this.asRecord(record.description);
          const primaryPhoto = this.asRecord(record.primary_photo);
          const flags = this.asRecord(record.flags);
          const status = this.asString(record.status) || this.asString(record.prop_status) || '';
          const isFsbo = Boolean(flags?.is_for_sale_by_owner) || /for sale by owner|fsbo/i.test(this.asString(record.description) || '');
          results.push({
            listingUrl,
            status,
            address: [this.asString(address?.line), this.asString(address?.city), this.asString(address?.state_code), this.asString(address?.postal_code)].filter(Boolean).join(', '),
            city: this.asString(address?.city),
            state: this.asString(address?.state_code),
            zipCode: this.asString(address?.postal_code),
            price: listPrice,
            bedrooms: this.asNumber(description?.beds) || this.asNumber(record.beds) || undefined,
            bathrooms: this.asNumber(description?.baths) || this.asNumber(record.baths) || undefined,
            squareFeet: this.asNumber(description?.sqft) || this.asNumber(record.sqft) || undefined,
            propertyType: this.asString(description?.type) || this.asString(record.prop_type),
            imageUrl: this.asString(primaryPhoto?.href),
            listingType: isFsbo ? 'FSBO' : 'Agent'
          });
        }
      }
      for (const child of Object.values(record)) {visit(child);}
    };
    visit(root);
    return results;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {return null;}
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value !== 'string') {return undefined;}
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {return value;}
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      if (!cleaned) {return undefined;}
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) {return parsed;}
    }
    return undefined;
  }
}

export class PropertyFilter {
  constructor(private criteria: SearchCriteria) {}

  filterProperties(properties: Property[]): FilteredProperty[] {
    return properties
    .filter(property => this.meetsBasicCriteria(property))
    .filter(property => this.isPurchasedDuringCovid(property))
    .filter(property => this.isOvervalued(property))
    .filter(property => this.isFSBO(property))
    .map(property => this.enrichWithAmenityData(property))
    .filter(filtered => this.meetsAmenityCriteria(filtered));
  }

  private meetsBasicCriteria(property: Property): boolean {
    if (this.criteria.states.length > 0 && !this.criteria.states.includes(property.state)) {return false;}
    if (this.criteria.minPrice && property.price < this.criteria.minPrice) {return false;}
    if (this.criteria.maxPrice && property.price > this.criteria.maxPrice) {return false;}
    return true;
  }

  private isPurchasedDuringCovid(property: Property): boolean {
    const purchaseDate = new Date(property.purchaseDate);
    const startDate = new Date(this.criteria.purchaseDateRange.start);
    const endDate = new Date(this.criteria.purchaseDateRange.end);
    return purchaseDate >= startDate && purchaseDate <= endDate;
  }

  private isOvervalued(property: Property): boolean {
    if (property.estimatedValue <= 0) {return false;}
    const percentAboveMarket = ((property.price - property.estimatedValue) / property.estimatedValue) * 100;
    return percentAboveMarket >= this.criteria.overvaluedThreshold;
  }

  private isFSBO(property: Property): boolean {
    if (!this.criteria.onlyFSBO) {return true;}
    return property.listingType === 'FSBO';
  }

  private enrichWithAmenityData(property: Property): FilteredProperty {
    const distanceToAmenities: { [key: string]: number } = {};

    this.criteria.amenities.forEach(amenity => {
      if (amenity.location && property.latitude !== 0 && property.longitude !== 0) {
        const distance = calculateDistance(
          property.latitude,
          property.longitude,
          amenity.location.latitude,
          amenity.location.longitude
        );
        const key = amenity.name || amenity.type;
        distanceToAmenities[key] = distance;
      }
    });
    const percentAboveMarket = ((property.price - property.estimatedValue) / property.estimatedValue) * 100;
    const dollarAboveMarket = property.price - property.estimatedValue;
    return {
      ...property,
      distanceToAmenities,
      overvaluedBy: Math.round(percentAboveMarket * 100) / 100,
      aboveMarketBy: Math.round(dollarAboveMarket)
    };
  }

  private meetsAmenityCriteria(property: FilteredProperty): boolean {
    const amenitiesWithLocations = this.criteria.amenities.filter(a => a.location);
    if (amenitiesWithLocations.length === 0) {return true;}
    for (const amenity of amenitiesWithLocations) {
      const key = amenity.name || amenity.type;
      const distance = property.distanceToAmenities[key];
      const maxDistance = amenity.searchRadius || this.criteria.maxDistanceToAmenities;
      if (distance > maxDistance) {return false;}
    }
    return true;
  }

  calculateMetrics(property: Property) {
    const safeEstimatedValue = property.estimatedValue > 0 ? property.estimatedValue : 1;
    const safePurchasePrice = property.purchasePrice > 0 ? property.purchasePrice : 1;
    const safeSquareFeet = property.squareFeet > 0 ? property.squareFeet : 1;
    const percentAboveMarket = ((property.price - safeEstimatedValue) / safeEstimatedValue) * 100;
    const percentIncreaseSincePurchase = ((property.price - safePurchasePrice) / safePurchasePrice) * 100;
    return {
      percentAboveMarket: Math.round(percentAboveMarket * 100) / 100,
      dollarAboveMarket: property.price - property.estimatedValue,
      percentIncreaseSincePurchase: Math.round(percentIncreaseSincePurchase * 100) / 100,
      dollarIncreaseSincePurchase: property.price - property.purchasePrice,
      pricePerSqFt: Math.round(property.price / safeSquareFeet)
    };
  }
}
