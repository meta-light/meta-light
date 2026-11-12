import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const prices = sqliteTable(
  'prices',
  {
    id: id(),
    timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull(),
    address: text('address').notNull(),
    price: real('price').notNull(),
    source: text('source').notNull(),
    chain: text('chain').notNull(),
    confidenceLevel: text('confidence_level'),
    bidAskSpread: real('bid_ask_spread'),
    spreadPercentage: real('spread_percentage'),
    liquidityScore: real('liquidity_score'),
    priceImpact10: real('price_impact_10'),
    priceImpact100: real('price_impact_100'),
    priceImpact1000: real('price_impact_1000'),
    isLiquid: integer('is_liquid', { mode: 'boolean' }),
    isStale: integer('is_stale', { mode: 'boolean' }),
    lastSwapAge: real('last_swap_age'),
    extraInfo: text('extra_info', { mode: 'json' }),
  },
  (table) => [
    index('prices_chain_token_timestamp_idx').on(
      table.chain,
      table.token,
      table.timestamp,
    ),
    index('prices_timestamp_idx').on(table.timestamp),
  ],
);

export const trades = sqliteTable(
  'trades',
  {
    id: id(),
    tradeId: text('trade_id').notNull(),
    strategy: text('strategy').default('Unified'),
    token: text('token').notNull(),
    action: text('action').notNull(),
    side: text('side').notNull(),
    amount: real('amount').notNull(),
    price: real('price').notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
    chain: text('chain').notNull(),
    positionSize: real('position_size'),
    averageEntryPrice: real('average_entry_price'),
    entryTimestamp: integer('entry_timestamp', { mode: 'timestamp_ms' }),
    pnl: real('pnl'),
    pnlPercentage: real('pnl_percentage'),
    holdingPeriodSeconds: real('holding_period_seconds'),
    isStopLoss: integer('is_stop_loss', { mode: 'boolean' }).default(false),
    isTakeProfit: integer('is_take_profit', { mode: 'boolean' }).default(false),
    sessionId: text('session_id'),
    portfolioValueBefore: real('portfolio_value_before'),
    portfolioValueAfter: real('portfolio_value_after'),
  },
  (table) => [
    uniqueIndex('trades_trade_id_idx').on(table.tradeId),
    index('trades_chain_token_timestamp_idx').on(
      table.chain,
      table.token,
      table.timestamp,
    ),
    index('trades_session_idx').on(table.sessionId),
  ],
);

export const tradingSessions = sqliteTable(
  'trading_sessions',
  {
    id: id(),
    sessionId: text('session_id').notNull(),
    chain: text('chain').notNull(),
    type: text('type').notNull(),
    startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp_ms' }),
    initialBalance: real('initial_balance').notNull(),
    finalBalance: real('final_balance'),
    totalTrades: integer('total_trades').notNull().default(0),
    profitableTrades: integer('profitable_trades').notNull().default(0),
    totalPnl: real('total_pnl').notNull().default(0),
    maxDrawdown: real('max_drawdown').notNull().default(0),
    strategiesTested: text('strategies_tested', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => ['Unified']),
    tokensTraded: text('tokens_traded', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    status: text('status').notNull().default('active'),
    sessionNotes: text('session_notes'),
    marketConditions: text('market_conditions', { mode: 'json' }),
  },
  (table) => [
    uniqueIndex('trading_sessions_session_id_idx').on(table.sessionId),
    index('trading_sessions_chain_type_status_idx').on(
      table.chain,
      table.type,
      table.status,
    ),
  ],
);
