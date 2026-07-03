import mongoose, { Schema, Document } from 'mongoose';

export interface IRentalListing extends Document {
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

const RentalListingSchema = new Schema<IRentalListing>({
  source: { type: String, enum: ['craigslist'], required: true },
  criteriaKey: { type: String, required: true, index: true },
  criteriaName: { type: String, required: true },
  listingId: { type: String, required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  searchUrl: { type: String, required: true },
  areaUrl: { type: String, required: true },
  searchPath: { type: String, required: true },
  locationText: { type: String },
  price: { type: Number },
  priceText: { type: String },
  bedrooms: { type: Number },
  squareFeet: { type: Number },
  latitude: { type: Number },
  longitude: { type: Number },
  postedAt: { type: Date, required: true, index: true },
  firstSeenAt: { type: Date, default: Date.now, index: true },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  notifiedAt: { type: Date, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  imageIds: { type: [String], default: [] },
  raw: { type: [Schema.Types.Mixed] }
}, {timestamps: true, collection: 'carp-rentals'});

RentalListingSchema.index({ source: 1, criteriaKey: 1, listingId: 1 }, { unique: true });
RentalListingSchema.index({ criteriaKey: 1, status: 1, postedAt: -1 });
RentalListingSchema.index({ criteriaKey: 1, notifiedAt: 1, firstSeenAt: -1 });

export const RentalListingModel = mongoose.models.RentalListing || mongoose.model<IRentalListing>('RentalListing', RentalListingSchema);
