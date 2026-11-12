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
