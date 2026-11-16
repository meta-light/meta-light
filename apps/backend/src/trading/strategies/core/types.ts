export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ContractSpec {
  multiplier: number;
  margin?: number;
  lotSize?: number;
  roundQuantity?(quantity: number): number;
}

export interface IndicatorSpec {
  function: 'SMA' | 'EMA' | 'RSI';
  priceCols: string[];
  params: { periods: number[] };
}

export type SlippageModel = { type: 'fixed_bps'; bps: number };

export type CommissionScheme =
  | { type: 'fixed_bps'; bps: number }
  | {
      type: 'per_share';
      costPerShare: number;
      minPerOrder: number;
      maxPct?: number;
    };

export interface RebalancePolicy {
  frequency: 'D' | 'W' | 'BME' | 'BQE' | null;
  weekday?: number;
  driftThreshold?: number;
  driftType?: 'absolute' | 'relative';
  partialRebalance?: boolean;
  trackingErrorThreshold?: number;
  trackingErrorWindow?: number;
  rebalanceOnSignalChange?: boolean;
  signalChangeThreshold?: number;
  maxDrawdownTrigger?: number;
  maxDrawdownAction?: 'flatten' | 'halve';
  circuitBreakerCooldownDays?: number;
  maxAnnualTurnover?: number;
  minTradeSize?: number;
}

export type RiskModel =
  | {
      type: 'vol_target';
      targetVol: number;
      lookback: number;
      maxLeverage: number;
    }
  | { type: 'risk_parity'; lookback: number }
  | { type: 'position_limit'; maxWeight: number }
  | { type: 'chain'; models: RiskModel[] };

export type ExecutionMode = 'weights' | 'orders';

export interface StrategyConfig {
  strategyName: string;
  strategyType?: string;
  initialCapital: number;
  instruments: string[];
  backtestPeriod: { start: string; end: string };
  granularity?: string;
  benchmarkSymbol: string;
  benchmarkName: string;
  source: string;
  executionMode: ExecutionMode;
  maxPositionSize?: number;
  rebalancePolicy?: RebalancePolicy;
  riskModel?: RiskModel;
  indicators: IndicatorSpec[];
  slippage?: SlippageModel;
  commission?: CommissionScheme;
}

export type OrderSide = 'buy' | 'sell';

export type OrderType =
  | 'market'
  | 'limit'
  | 'stop'
  | 'stop_limit'
  | 'stop_trail'
  | 'stop_trail_limit'
  | 'oco'
  | 'bracket';

export type TimeInForce = 'GTC' | 'DAY' | 'GTD';

export interface BracketSpec {
  takeProfitPrice?: number;
  stopLossPrice?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  takeProfitType?: OrderType;
  stopLossType?: OrderType;
  stopLimitPrice?: number;
  stopLimitOffset?: number;
  trailAmount?: number;
  trailPercent?: number;
}

export interface Order {
  instrument: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  limitOffset?: number;
  trailAmount?: number;
  trailPercent?: number;
  bracket?: BracketSpec;
  ocoPairId?: string;
  timeInForce?: TimeInForce;
  expiresAfterBars?: number;
  tag?: string;
}

export interface PendingOrder extends Order {
  orderId: string;
  isActive: boolean;
}

export interface FillEngine {
  readonly pendingOrders: readonly PendingOrder[];
  submit(order: Order): void;
  cancelAll(filter?: { instrument?: string }): void;
}

export interface WalkForwardConfig {
  scheme: 'rolling' | 'expanding' | 'anchored';
  trainMonths: number;
  testMonths: number;
  stepMonths: number;
  purgeDays: number;
  extraPreOosPurgePct?: number;
}

export type WalkForwardMode = 'slice_diagnostics' | 'per_fold_refit';

export interface FoldWindow {
  foldId: number;
  trainStart: string;
  trainEnd: string;
  oosStart: string;
  oosEnd: string;
}
