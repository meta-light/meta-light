import { Schema } from 'mongoose';

export interface TradeEntry {
    _id?: any;
    trade_id: string;
    strategy?: string;
    token: string;
    action: 'OPEN' | 'CLOSE';
    side: 'BUY' | 'SELL';
    amount: number;
    price: number;
    timestamp: Date;
    chain: 'SOLANA' | 'ECLIPSE';
    position_size?: number;
    average_entry_price?: number;
    entry_timestamp?: Date;
    pnl?: number;
    pnl_percentage?: number;
    holding_period_seconds?: number;
    is_stop_loss?: boolean;
    is_take_profit?: boolean;
    session_id?: string;
    portfolio_value_before?: number;
    portfolio_value_after?: number;
}

export const TradeSchema = new Schema({
    trade_id: { type: String, required: true, unique: true, index: true },
    strategy: { type: String, default: 'Unified', index: true },
    token: { type: String, required: true, index: true },
    action: { type: String, enum: ['OPEN', 'CLOSE'], required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    amount: { type: Number, required: true },
    price: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
    chain: { type: String, enum: ['SOLANA', 'ECLIPSE'], required: true, index: true },
    position_size: { type: Number },
    average_entry_price: { type: Number },
    entry_timestamp: { type: Date },
    pnl: { type: Number },
    pnl_percentage: { type: Number },
    holding_period_seconds: { type: Number },
    is_stop_loss: { type: Boolean, default: false },
    is_take_profit: { type: Boolean, default: false },
    session_id: { type: String, index: true },
    portfolio_value_before: { type: Number },
    portfolio_value_after: { type: Number }
}, {timestamps: false, collection: 'trades'});