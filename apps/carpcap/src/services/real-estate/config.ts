import { SearchCriteria } from './Property';

export const defaultSearchCriteria: SearchCriteria = {
  states: ['CA', 'TX', 'FL'],
  regions: ['Los Angeles County', 'Orange County', 'San Diego County'],
  minPrice: 300000,
  maxPrice: 2000000,
  purchaseDateRange: {start: '2020-03-01', end: '2022-12-31'},
  overvaluedThreshold: 15, // 15% above market
  onlyFSBO: false,
  maxDistanceToAmenities: 5,
  amenities: [
    { type: 'beach', searchRadius: 30 },
    { type: 'ski area', searchRadius: 20 },
    { type: 'airport', searchRadius: 20 }
  ]
};

export const mapConfig = {
  provider: 'openstreetmap',
  defaultCenter: {
    lat: 34.0522,
    lng: -118.2437
  },
  defaultZoom: 10
};

export const apiConfig = {
  realtorSearchBaseUrl: 'https://www.realtor.com/realestateandhomes-search',
  realtorDefaultCityByState: {
    CA: 'Los Angeles',
    TX: 'Austin',
    FL: 'Miami'
  } as Record<string, string>,
  nominatimSearchUrl: 'https://nominatim.openstreetmap.org/search',
  overpassApiUrl: 'https://overpass-api.de/api/interpreter',
  userAgent: 'carpcap-real-estate-service/1.0',
  requestTimeoutMs: 15000,
  overpassTimeoutSeconds: 25,
  searchRadiusMeters: 20000,
  defaultPropertyLimit: 100,
  fallbackToCustomDataOnError: false,
  useCustomData: false,
  customDataPath: 'src/services/real-estate/data/properties.json'
};
