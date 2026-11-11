export interface TradeEntry {
    _id?: string;
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
