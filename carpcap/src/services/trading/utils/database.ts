import mongoose, { Model } from 'mongoose';
import { MONGODB_URI } from '../../../env';
import { PriceEntry, PriceSchema } from '../models/price';
import { TradeEntry, TradeSchema } from '../models/trade';
import { SessionSchema, TradingSession } from '../models/session';
import { log } from './logger';

let isGloballyConnected = false;
type TradingType = 'SOLANA' | 'ECLIPSE';

class TradingDatabase {
    private collectionPrefix: string;
    private chain: TradingType;
    private type: 'PAPER' | 'production';
    private priceModel: Model<any>;
    private tradeModel: Model<any>;
    private sessionModel: Model<any>;
    
    constructor(tradingType: TradingType, type: 'PAPER' | 'production' = 'PAPER') {
        if (!MONGODB_URI) {throw new Error('[database]: MONGODB_URI environment variable is required');}
        this.collectionPrefix = tradingType;
        this.chain = tradingType;
        this.type = type;
        try {this.priceModel = mongoose.model('prices');} 
        catch {this.priceModel = mongoose.model('prices', PriceSchema, 'prices');}
        try {this.tradeModel = mongoose.model('trades');} 
        catch {this.tradeModel = mongoose.model('trades', TradeSchema, 'trades');}
        try {this.sessionModel = mongoose.model('sessions');} 
        catch {this.sessionModel = mongoose.model('sessions', SessionSchema, 'sessions');}
    }
    
    async connect(): Promise<void> {
        if (isGloballyConnected) return;
        try {
            await mongoose.connect(MONGODB_URI!);
            isGloballyConnected = true;
            log.database('Connected to MongoDB trading database via Mongoose');
        } 
        catch (error) {log.error('DATABASE', 'Failed to connect to MongoDB', error); throw error;}
    }

    async disconnect(): Promise<void> {
        if (isGloballyConnected) { await mongoose.disconnect();  isGloballyConnected = false;  log.database('Disconnected from MongoDB trading database');}
    }

    async logPrice(priceData: Omit<PriceEntry, '_id' | 'chain'>): Promise<void> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {
            const priceWithChain = { ...priceData, chain: this.chain };
            await this.priceModel.create(priceWithChain);
        } 
        catch (error) {log.error('DATABASE', `Error logging price to ${this.collectionPrefix}`, error);}
    }

    async logPrices(pricesData: Omit<PriceEntry, '_id' | 'chain'>[]): Promise<void> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {
            if (pricesData.length > 0) {
                const pricesWithChain = pricesData.map(price => ({ ...price, chain: this.chain }));
                await this.priceModel.insertMany(pricesWithChain);
            }
        } 
        catch (error) {log.error('DATABASE', `Error logging prices to ${this.collectionPrefix}`, error);}
    }

    async getLatestPrices(tokens: string[]): Promise<{ [token: string]: PriceEntry }> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const latestPrices: { [token: string]: PriceEntry } = {};
        for (const token of tokens) {
            const latestPrice = await this.priceModel.findOne({ token, chain: this.chain }).sort({ timestamp: -1 }).lean();
            if (latestPrice) {latestPrices[token] = latestPrice as unknown as PriceEntry;}
        }
        return latestPrices;
    }

    async getPriceHistory(token: string, limit: number = 100): Promise<PriceEntry[]> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const prices = await this.priceModel.find({ token, chain: this.chain }).sort({ timestamp: -1 }).limit(limit).lean();
        return prices as unknown as PriceEntry[];
    }

    async logTrade(tradeData: Omit<TradeEntry, '_id' | 'chain'>): Promise<string> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {
            const tradeWithChain = { ...tradeData, chain: this.chain };
            const result = await this.tradeModel.create(tradeWithChain); 
            return result._id.toString();
        } 
        catch (error) {log.error('DATABASE', `Error logging trade to ${this.collectionPrefix}`, error); throw error;}
    }

    async updateTrade(tradeId: string, updateData: Partial<TradeEntry>): Promise<void> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {await this.tradeModel.updateOne({ trade_id: tradeId, chain: this.chain }, { $set: updateData });} 
        catch (error) {log.error('DATABASE', `Error updating trade in ${this.collectionPrefix}`, error);}
    }

    async getOpenTrades(strategy: string, token: string): Promise<TradeEntry[]> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const trades = await this.tradeModel.find({strategy, token, action: 'OPEN', chain: this.chain}).sort({ timestamp: -1 }).lean();
        return trades as unknown as TradeEntry[];
    }

    async getTradeHistory(strategy?: string, token?: string, limit: number = 100): Promise<TradeEntry[]> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const filter: any = { chain: this.chain };
        if (strategy) filter.strategy = strategy;
        if (token) filter.token = token;
        const trades = await this.tradeModel.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
        return trades as unknown as TradeEntry[];
    }

    async createSession(sessionData: Omit<TradingSession, '_id' | 'chain' | 'type'>): Promise<string> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {
            const sessionWithChainAndType = {...sessionData, chain: this.chain, type: this.type};
            const result = await this.sessionModel.create(sessionWithChainAndType); 
            return result._id.toString();
        } 
        catch (error) {log.error('DATABASE', 'Error creating session', error); throw error;}
    }

    async updateSession(sessionId: string, updateData: Partial<TradingSession>): Promise<void> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {await this.sessionModel.updateOne({ session_id: sessionId, chain: this.chain, type: this.type }, { $set: updateData });} 
        catch (error) {log.error('DATABASE', 'Error updating session', error);}
    }

    async getActiveSession(): Promise<TradingSession | null> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const session = await this.sessionModel.findOne({ status: 'active', chain: this.chain, type: this.type }).lean();
        return session as TradingSession | null;
    }

    async getSessionStats(sessionId: string): Promise<{totalTrades: number; profitableTrades: number; totalPnL: number; winRate: number; averageHoldingTime: number; bestTrade: TradeEntry | null; worstTrade: TradeEntry | null;} | null> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        const trades = await this.tradeModel.find({ session_id: sessionId, action: 'CLOSE', chain: this.chain }).lean() as unknown as TradeEntry[];
        if (trades.length === 0) return null;
        const profitableTrades = trades.filter(t => (t.pnl || 0) > 0);
        const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const avgHoldingTime = trades.reduce((sum, t) => sum + (t.holding_period_seconds || 0), 0) / trades.length;
        const bestTrade = trades.reduce((best, current) => (current.pnl || 0) > (best.pnl || 0) ? current : best);
        const worstTrade = trades.reduce((worst, current) => (current.pnl || 0) < (worst.pnl || 0) ? current : worst);
        return {totalTrades: trades.length, profitableTrades: profitableTrades.length, totalPnL, winRate: profitableTrades.length / trades.length, averageHoldingTime: avgHoldingTime, bestTrade, worstTrade};
    }

    async getTotalTradeCount(): Promise<number> {
        if (!isGloballyConnected) throw new Error('[database]: Database not connected');
        try {
            const count = await this.tradeModel.countDocuments({ chain: this.chain });
            return count;
        } catch (error) {
            log.error('DATABASE', `Error counting trades for ${this.chain}`, error);
            return 0;
        }
    }
    
    getCollectionPrefix(): string {return this.collectionPrefix;}
    getChain(): TradingType {return this.chain;}
    getType(): 'PAPER' | 'production' {return this.type;}
}

export const solanaTradingDB = new TradingDatabase('SOLANA', 'PAPER');
export const eclipseTradingDB = new TradingDatabase('ECLIPSE', 'PAPER');
export { TradingDatabase, TradingType }; 