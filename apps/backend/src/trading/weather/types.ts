import type { Venue } from './cities';

export interface Quote {
  t: number;
  bid: number | null;
  ask: number | null;
}

export interface Bucket {
  id: string;
  label: string;
  lo: number;
  hi: number;
  result: 0 | 1;
  quotes: Quote[];
}

export interface FeeModel {
  venue: Venue;
  rate: number;
}

export interface MarketEvent {
  venue: Venue;
  cityId: string;
  date: string;
  closeMs: number;
  buckets: Bucket[];
  fee: FeeModel;
  settledHigh: number | null;
}
