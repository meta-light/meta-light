import { Schema } from 'mongoose';

export interface TradingSession {
    _id?: string;
    session_id: string;
    chain: 'SOLANA' | 'ECLIPSE';
    type: 'PAPER' | 'production';
    start_time: Date;
    end_time?: Date;
    initial_balance: number;
    final_balance?: number;
    total_trades: number;
    profitable_trades: number;
    total_pnl: number;
    max_drawdown: number;
    strategies_tested?: string[];
    tokens_traded: string[];
    status: 'active' | 'completed' | 'stopped';
    session_notes?: string;
    market_conditions?: {
        overall_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        volatility_level: 'LOW' | 'MEDIUM' | 'HIGH';
        major_events?: string[];
    };
}

export const SessionSchema = new Schema({
    session_id: { type: String, required: true, unique: true, index: true },
    chain: { type: String, enum: ['SOLANA', 'ECLIPSE'], required: true, index: true },
    type: { type: String, enum: ['PAPER', 'production'], required: true, index: true },
    start_time: { type: Date, required: true, index: true },
    end_time: { type: Date },
    initial_balance: { type: Number, required: true },
    final_balance: { type: Number },
    total_trades: { type: Number, default: 0 },
    profitable_trades: { type: Number, default: 0 },
    total_pnl: { type: Number, default: 0 },
    max_drawdown: { type: Number, default: 0 },
    strategies_tested: { type: [String], default: ['Unified'] },
    tokens_traded: [{ type: String }],
    status: { type: String, enum: ['active', 'completed', 'stopped'], default: 'active' },
    session_notes: { type: String },
    market_conditions: {
        overall_sentiment: { type: String, enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
        volatility_level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] },
        major_events: [{ type: String }]
    }
}, {timestamps: false, collection: 'sessions'});