export type MarketplaceId = "openrouter" | "liquid" | "antseed" | "surplus" | "orbio";
export type Channel = MarketplaceId | "direct";
export type Extra = Record<string, unknown>;

export interface Marketplace {
  id: MarketplaceId;
  name: string;
  url: string;
  kind: "router" | "exchange" | "p2p";
  dayBasis: string;
  coverage: "all" | "tracked";
  extra: Extra;
}

export interface ProviderAlias {
  channel: Channel;
  externalId: string;
  slug: string;
  name: string;
  extra: Extra;
}

export interface Provider {
  id: string;
  name: string;
  tracked: boolean;
  aliases: ProviderAlias[];
}

export interface Lab {
  id: string;
  name: string;
}

export interface ModelAlias {
  channel: Channel;
  provider?: string;
  raw: string;
  name?: string;
}

export interface Model {
  id: string;
  name: string;
  lab: string;
  context?: number;
  matched: boolean;
  aliases: ModelAlias[];
  extra: Extra;
}

export interface Price {
  prompt: number;
  completion: number;
  cacheRead?: number;
}

export interface Listing {
  channel: Channel;
  provider?: string;
  model: string;
  rawModel: string;
  variant?: string;
  price?: Price;
  priceMax?: Price;
  context?: number;
  status?: string;
  extra: Extra;
}

export interface Usage {
  channel: Channel;
  provider?: string;
  model?: string;
  date: string;
  tokens: number;
  requests?: number;
  extra?: Extra;
}

export interface UsageTotal {
  channel: Channel;
  provider?: string;
  model?: string;
  days: number;
  asOf: string;
  tokens: number;
  requests?: number;
  extra?: Extra;
}

export interface Health {
  channel: Channel;
  provider: string;
  model?: string;
  variant?: string;
  window: string;
  uptime?: number;
  p50LatencyMs?: number;
  p50TokensPerSec?: number;
  ttftMs?: number;
  requests?: number;
  extra: Extra;
}

export type InstrumentClass = "spot" | "quantity" | "dollar" | "access";

export interface Instrument {
  id: string;
  name: string;
  issuer: string;
  class: InstrumentClass;
  venue: string;
  url: string;
  claim: string;
  price?: number;
  face?: number;
  discount?: number;
  yield?: number;
  supply?: number;
  size?: { value: number; unit: "usd" | "tokens"; label: string };
  expiry?: string;
  menu?: Listing[];
  history?: Array<{ label: string; unit: string; points: Array<{ date: string; value: number }> }>;
  source: "live" | "report";
  asOf: string;
  notes?: string;
  extra: Extra;
}

export interface Snapshot {
  generated: string;
  through: string;
  marketplaces: Marketplace[];
  providers: Provider[];
  labs: Lab[];
  models: Model[];
  listings: Listing[];
  usage: Usage[];
  totals: UsageTotal[];
  health: Health[];
  instruments: Instrument[];
  errors: string[];
}
