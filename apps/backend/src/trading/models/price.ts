export interface PriceEntry {
  _id?: string;
  timestamp: Date;
  token: string;
  address: string;
  price: number;
  source: 'jupiter' | 'manual' | 'deserialize';
  chain: 'SOLANA' | 'ECLIPSE';
  confidenceLevel?: 'high' | 'medium' | 'low';
  bidAskSpread?: number;
  spreadPercentage?: number;
  liquidityScore?: number;
  priceImpact10?: number;
  priceImpact100?: number;
  priceImpact1000?: number;
  isLiquid?: boolean;
  isStale?: boolean;
  lastSwapAge?: number;
  extraInfo?: {
    lastSwappedPrice?: {
      lastJupiterSellAt?: number;
      lastJupiterSellPrice?: string;
      lastJupiterBuyAt?: number;
      lastJupiterBuyPrice?: string;
    };
    quotedPrice?: {
      buyPrice?: string;
      buyAt?: number;
      sellPrice?: string;
      sellAt?: number;
    };
    depth?: {
      buyPriceImpactRatio?: {
        depth: { '10': number; '100': number; '1000': number };
        timestamp: number;
      };
      sellPriceImpactRatio?: {
        depth: { '10': number; '100': number; '1000': number };
        timestamp: number;
      };
    };
  };
}
