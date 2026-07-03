export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  price: number;
  estimatedValue: number;
  purchaseDate: string;
  purchasePrice: number;
  listingType: 'FSBO' | 'Agent' | 'Auction';
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt: number;
  propertyType: string;
  listingUrl?: string;
  description?: string;
  images?: string[];
}

export interface SearchCriteria {
  states: string[];
  regions?: string[];
  minPrice?: number;
  maxPrice?: number;
  purchaseDateRange: { start: string; end: string;};
  overvaluedThreshold: number;
  onlyFSBO: boolean;
  amenities: Amenity[];
  maxDistanceToAmenities: number;
}

export interface Amenity {
  type: AmenityType;
  name?: string;
  location?: {latitude: number; longitude: number;};
  searchRadius?: number;
}

export type AmenityType =
  | 'school'
  | 'hospital'
  | 'shopping'
  | 'restaurant'
  | 'park'
  | 'gym'
  | 'beach'
  | 'ski_resort'
  | 'golf_course'
  | 'airport'
  | 'train_station'
  | 'highway'
  | 'downtown'
  | 'custom'
  | 'ski area';

export interface FilteredProperty extends Property {
  distanceToAmenities: {[amenityType: string]: number;};
  overvaluedBy: number;
  aboveMarketBy: number;
}
