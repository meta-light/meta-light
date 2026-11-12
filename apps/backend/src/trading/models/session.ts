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
