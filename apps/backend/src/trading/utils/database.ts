import { and, desc, eq, sql } from 'drizzle-orm';
import {
  closeDatabase,
  connectDatabase,
  getDb,
  isDatabaseConnected,
} from '../../database/client';
import { trades, tradingSessions } from '../schema';
import { insertPrices, latestPrice, priceHistory } from '../prices';
import { PriceEntry } from '../models/price';
import { TradeEntry } from '../models/trade';
import { TradingSession } from '../models/session';
import { log } from './logger';

let isGloballyConnected = false;
type TradingType = 'SOLANA' | 'ECLIPSE';
type TradeRow = typeof trades.$inferSelect;
type SessionRow = typeof tradingSessions.$inferSelect;

function toTrade(row: TradeRow): TradeEntry {
  return {
    _id: row.id,
    trade_id: row.tradeId,
    strategy: row.strategy ?? undefined,
    token: row.token,
    action: row.action as TradeEntry['action'],
    side: row.side as TradeEntry['side'],
    amount: row.amount,
    price: row.price,
    timestamp: row.timestamp,
    chain: row.chain as TradeEntry['chain'],
    position_size: row.positionSize ?? undefined,
    average_entry_price: row.averageEntryPrice ?? undefined,
    entry_timestamp: row.entryTimestamp ?? undefined,
    pnl: row.pnl ?? undefined,
    pnl_percentage: row.pnlPercentage ?? undefined,
    holding_period_seconds: row.holdingPeriodSeconds ?? undefined,
    is_stop_loss: row.isStopLoss ?? undefined,
    is_take_profit: row.isTakeProfit ?? undefined,
    session_id: row.sessionId ?? undefined,
    portfolio_value_before: row.portfolioValueBefore ?? undefined,
    portfolio_value_after: row.portfolioValueAfter ?? undefined,
  };
}

function defined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function toSession(row: SessionRow): TradingSession {
  return {
    _id: row.id,
    session_id: row.sessionId,
    chain: row.chain as TradingSession['chain'],
    type: row.type as TradingSession['type'],
    start_time: row.startTime,
    end_time: row.endTime ?? undefined,
    initial_balance: row.initialBalance,
    final_balance: row.finalBalance ?? undefined,
    total_trades: row.totalTrades,
    profitable_trades: row.profitableTrades,
    total_pnl: row.totalPnl,
    max_drawdown: row.maxDrawdown,
    strategies_tested: row.strategiesTested,
    tokens_traded: row.tokensTraded,
    status: row.status as TradingSession['status'],
    session_notes: row.sessionNotes ?? undefined,
    market_conditions: (row.marketConditions ??
      undefined) as TradingSession['market_conditions'],
  };
}

class TradingDatabase {
  private collectionPrefix: string;
  private chain: TradingType;
  private type: 'PAPER' | 'production';

  constructor(
    tradingType: TradingType,
    type: 'PAPER' | 'production' = 'PAPER',
  ) {
    this.collectionPrefix = tradingType;
    this.chain = tradingType;
    this.type = type;
  }

  async connect(): Promise<void> {
    if (isGloballyConnected) return;
    try {
      await connectDatabase();
      isGloballyConnected = true;
      log.database('Connected to D1');
    } catch (error) {
      log.error('DATABASE', 'Failed to connect to D1', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!isGloballyConnected) return;
    isGloballyConnected = false;
    log.database(
      'Released trading database connection. Shared D1 client stays open.',
    );
  }

  private assertConnected(): void {
    if (!isGloballyConnected || !isDatabaseConnected())
      throw new Error('[database]: Database not connected');
  }

  async logPrice(priceData: Omit<PriceEntry, '_id' | 'chain'>): Promise<void> {
    this.assertConnected();
    try {
      await insertPrices([{ ...priceData, chain: this.chain }]);
    } catch (error) {
      log.error(
        'DATABASE',
        `Error logging price to ${this.collectionPrefix}`,
        error,
      );
    }
  }

  async logPrices(
    pricesData: Omit<PriceEntry, '_id' | 'chain'>[],
  ): Promise<void> {
    this.assertConnected();
    try {
      await insertPrices(
        pricesData.map((price) => ({ ...price, chain: this.chain })),
      );
    } catch (error) {
      log.error(
        'DATABASE',
        `Error logging prices to ${this.collectionPrefix}`,
        error,
      );
    }
  }

  async getLatestPrices(
    tokens: string[],
  ): Promise<{ [token: string]: PriceEntry }> {
    this.assertConnected();
    const latestPrices: { [token: string]: PriceEntry } = {};
    for (const token of tokens) {
      const latest = await latestPrice(token, this.chain);
      if (latest) latestPrices[token] = latest;
    }
    return latestPrices;
  }

  async getPriceHistory(
    token: string,
    limit: number = 100,
  ): Promise<PriceEntry[]> {
    this.assertConnected();
    return priceHistory(token, this.chain, limit);
  }

  async logTrade(
    tradeData: Omit<TradeEntry, '_id' | 'chain'>,
  ): Promise<string> {
    this.assertConnected();
    try {
      const [row] = await getDb()
        .insert(trades)
        .values({
          tradeId: tradeData.trade_id,
          strategy: tradeData.strategy,
          token: tradeData.token,
          action: tradeData.action,
          side: tradeData.side,
          amount: tradeData.amount,
          price: tradeData.price,
          timestamp: tradeData.timestamp,
          chain: this.chain,
          positionSize: tradeData.position_size,
          averageEntryPrice: tradeData.average_entry_price,
          entryTimestamp: tradeData.entry_timestamp,
          pnl: tradeData.pnl,
          pnlPercentage: tradeData.pnl_percentage,
          holdingPeriodSeconds: tradeData.holding_period_seconds,
          isStopLoss: tradeData.is_stop_loss,
          isTakeProfit: tradeData.is_take_profit,
          sessionId: tradeData.session_id,
          portfolioValueBefore: tradeData.portfolio_value_before,
          portfolioValueAfter: tradeData.portfolio_value_after,
        })
        .returning({ id: trades.id });
      return row.id;
    } catch (error) {
      log.error(
        'DATABASE',
        `Error logging trade to ${this.collectionPrefix}`,
        error,
      );
      throw error;
    }
  }

  async updateTrade(
    tradeId: string,
    updateData: Partial<TradeEntry>,
  ): Promise<void> {
    this.assertConnected();
    try {
      await getDb()
        .update(trades)
        .set(
          defined({
            strategy: updateData.strategy,
            token: updateData.token,
            action: updateData.action,
            side: updateData.side,
            amount: updateData.amount,
            price: updateData.price,
            timestamp: updateData.timestamp,
            positionSize: updateData.position_size,
            averageEntryPrice: updateData.average_entry_price,
            entryTimestamp: updateData.entry_timestamp,
            pnl: updateData.pnl,
            pnlPercentage: updateData.pnl_percentage,
            holdingPeriodSeconds: updateData.holding_period_seconds,
            isStopLoss: updateData.is_stop_loss,
            isTakeProfit: updateData.is_take_profit,
            sessionId: updateData.session_id,
            portfolioValueBefore: updateData.portfolio_value_before,
            portfolioValueAfter: updateData.portfolio_value_after,
          }),
        )
        .where(and(eq(trades.tradeId, tradeId), eq(trades.chain, this.chain)));
    } catch (error) {
      log.error(
        'DATABASE',
        `Error updating trade in ${this.collectionPrefix}`,
        error,
      );
    }
  }

  async getOpenTrades(strategy: string, token: string): Promise<TradeEntry[]> {
    this.assertConnected();
    const rows = await getDb()
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.strategy, strategy),
          eq(trades.token, token),
          eq(trades.action, 'OPEN'),
          eq(trades.chain, this.chain),
        ),
      )
      .orderBy(desc(trades.timestamp));
    return rows.map(toTrade);
  }

  async getTradeHistory(
    strategy?: string,
    token?: string,
    limit: number = 100,
  ): Promise<TradeEntry[]> {
    this.assertConnected();
    const filters = [eq(trades.chain, this.chain)];
    if (strategy) filters.push(eq(trades.strategy, strategy));
    if (token) filters.push(eq(trades.token, token));
    const rows = await getDb()
      .select()
      .from(trades)
      .where(and(...filters))
      .orderBy(desc(trades.timestamp))
      .limit(limit);
    return rows.map(toTrade);
  }

  async createSession(
    sessionData: Omit<TradingSession, '_id' | 'chain' | 'type'>,
  ): Promise<string> {
    this.assertConnected();
    try {
      const [row] = await getDb()
        .insert(tradingSessions)
        .values({
          sessionId: sessionData.session_id,
          chain: this.chain,
          type: this.type,
          startTime: sessionData.start_time,
          endTime: sessionData.end_time,
          initialBalance: sessionData.initial_balance,
          finalBalance: sessionData.final_balance,
          totalTrades: sessionData.total_trades,
          profitableTrades: sessionData.profitable_trades,
          totalPnl: sessionData.total_pnl,
          maxDrawdown: sessionData.max_drawdown,
          strategiesTested: sessionData.strategies_tested ?? ['Unified'],
          tokensTraded: sessionData.tokens_traded,
          status: sessionData.status,
          sessionNotes: sessionData.session_notes,
          marketConditions: sessionData.market_conditions,
        })
        .returning({ sessionId: tradingSessions.sessionId });
      return row.sessionId;
    } catch (error) {
      log.error('DATABASE', 'Error creating session', error);
      throw error;
    }
  }

  async updateSession(
    sessionId: string,
    updateData: Partial<TradingSession>,
  ): Promise<void> {
    this.assertConnected();
    try {
      await getDb()
        .update(tradingSessions)
        .set(
          defined({
            endTime: updateData.end_time,
            finalBalance: updateData.final_balance,
            totalTrades: updateData.total_trades,
            profitableTrades: updateData.profitable_trades,
            totalPnl: updateData.total_pnl,
            maxDrawdown: updateData.max_drawdown,
            strategiesTested: updateData.strategies_tested,
            tokensTraded: updateData.tokens_traded,
            status: updateData.status,
            sessionNotes: updateData.session_notes,
            marketConditions: updateData.market_conditions,
          }),
        )
        .where(
          and(
            eq(tradingSessions.sessionId, sessionId),
            eq(tradingSessions.chain, this.chain),
            eq(tradingSessions.type, this.type),
          ),
        );
    } catch (error) {
      log.error('DATABASE', 'Error updating session', error);
    }
  }

  async getActiveSession(): Promise<TradingSession | null> {
    this.assertConnected();
    const [row] = await getDb()
      .select()
      .from(tradingSessions)
      .where(
        and(
          eq(tradingSessions.status, 'active'),
          eq(tradingSessions.chain, this.chain),
          eq(tradingSessions.type, this.type),
        ),
      )
      .limit(1);
    return row ? toSession(row) : null;
  }

  async getSessionStats(sessionId: string): Promise<{
    totalTrades: number;
    profitableTrades: number;
    totalPnL: number;
    winRate: number;
    averageHoldingTime: number;
    bestTrade: TradeEntry | null;
    worstTrade: TradeEntry | null;
  } | null> {
    this.assertConnected();
    const rows = await getDb()
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.sessionId, sessionId),
          eq(trades.action, 'CLOSE'),
          eq(trades.chain, this.chain),
        ),
      );
    const closed = rows.map(toTrade);
    if (closed.length === 0) return null;
    const profitableTrades = closed.filter((trade) => (trade.pnl || 0) > 0);
    const totalPnL = closed.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const avgHoldingTime =
      closed.reduce(
        (sum, trade) => sum + (trade.holding_period_seconds || 0),
        0,
      ) / closed.length;
    const bestTrade = closed.reduce((best, current) =>
      (current.pnl || 0) > (best.pnl || 0) ? current : best,
    );
    const worstTrade = closed.reduce((worst, current) =>
      (current.pnl || 0) < (worst.pnl || 0) ? current : worst,
    );
    return {
      totalTrades: closed.length,
      profitableTrades: profitableTrades.length,
      totalPnL,
      winRate: profitableTrades.length / closed.length,
      averageHoldingTime: avgHoldingTime,
      bestTrade,
      worstTrade,
    };
  }

  async getTotalTradeCount(): Promise<number> {
    this.assertConnected();
    try {
      const [row] = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(trades)
        .where(eq(trades.chain, this.chain));
      return Number(row?.count ?? 0);
    } catch (error) {
      log.error('DATABASE', `Error counting trades for ${this.chain}`, error);
      return 0;
    }
  }

  getCollectionPrefix(): string {
    return this.collectionPrefix;
  }
  getChain(): TradingType {
    return this.chain;
  }
  getType(): 'PAPER' | 'production' {
    return this.type;
  }
}

export async function shutdownDatabase(): Promise<void> {
  isGloballyConnected = false;
  await closeDatabase();
}

export const solanaTradingDB = new TradingDatabase('SOLANA', 'PAPER');
export const eclipseTradingDB = new TradingDatabase('ECLIPSE', 'PAPER');
export { TradingDatabase, TradingType };
