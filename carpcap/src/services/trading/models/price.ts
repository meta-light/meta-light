import { Schema } from 'mongoose';

const PriceDepthSchema = new Schema({
    '10': { type: Number },
    '100': { type: Number },
    '1000': { type: Number }
}, { _id: false });

const PriceImpactRatioSchema = new Schema({
    depth: PriceDepthSchema,
    timestamp: { type: Number }
}, { _id: false });

const LastSwappedPriceSchema = new Schema({
    lastJupiterSellAt: { type: Number },
    lastJupiterSellPrice: { type: String },
    lastJupiterBuyAt: { type: Number },
    lastJupiterBuyPrice: { type: String }
}, { _id: false });

const QuotedPriceSchema = new Schema({
    buyPrice: { type: String },
    buyAt: { type: Number },
    sellPrice: { type: String },
    sellAt: { type: Number }
}, { _id: false });

const DepthSchema = new Schema({
    buyPriceImpactRatio: PriceImpactRatioSchema,
    sellPriceImpactRatio: PriceImpactRatioSchema
}, { _id: false });

const ExtraInfoSchema = new Schema({
    lastSwappedPrice: LastSwappedPriceSchema,
    quotedPrice: QuotedPriceSchema,
    depth: DepthSchema
}, { _id: false });

export interface PriceEntry {
    _id?: any;
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
                depth: {
                    '10': number;
                    '100': number;
                    '1000': number;
                };
                timestamp: number;
            };
            sellPriceImpactRatio?: {
                depth: {
                    '10': number;
                    '100': number;
                    '1000': number;
                };
                timestamp: number;
            };
        };
    };
}

export const PriceSchema = new Schema({
    timestamp: { type: Date, required: true, index: true },
    token: { type: String, required: true, index: true },
    address: { type: String, required: true },
    price: { type: Number, required: true },
    source: { type: String, enum: ['jupiter', 'manual', 'deserialize'], required: true },
    chain: { type: String, enum: ['SOLANA', 'ECLIPSE'], required: true, index: true },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'] },
    bidAskSpread: { type: Number },
    spreadPercentage: { type: Number },
    liquidityScore: { type: Number },
    priceImpact10: { type: Number },
    priceImpact100: { type: Number },
    priceImpact1000: { type: Number },
    isLiquid: { type: Boolean },
    isStale: { type: Boolean },
    lastSwapAge: { type: Number },
    extraInfo: ExtraInfoSchema
}, {timestamps: false, collection: 'prices'});