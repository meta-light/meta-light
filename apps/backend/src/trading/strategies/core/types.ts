// Config and order types for the strategy templates. These mirror the
// QuantJourney backtester's Python API (camelCase here) so the ported
// strategies keep their original settings. Nothing here runs a backtest; an
// engine still has to consume these.

// --- Market data ----------------------------------------------------------

export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Per-instrument contract details supplied by the data provider. */
export interface ContractSpec {
  /** Price multiplier (futures point value, FX units per price point). */
  multiplier: number;
  /** Initial margin per contract, for futures. */
  margin?: number;
  /** Units per standard lot, for FX. */
  lotSize?: number;
}

/** Indicator columns the engine precomputes, e.g. SMA(50) -> "SMA_50_close". */
export interface IndicatorSpec {
  function: 'SMA' | 'EMA' | 'RSI';
  priceCols: string[];
  params: { periods: number[] };
}

// --- Execution costs ------------------------------------------------------

export type SlippageModel = { type: 'fixed_bps'; bps: number };

export type CommissionScheme =
  | { type: 'fixed_bps'; bps: number }
  | {
      type: 'per_share';
      costPerShare: number;
      minPerOrder: number;
      maxPct?: number;
    };

// --- Portfolio rules ------------------------------------------------------

/**
 * When the weights engine rebalances. Frequencies use pandas offset codes:
 * "D" daily, "W" weekly (on `weekday`, 0 = Mon), "BME" business month-end,
 * "BQE" business quarter-end, `null` = only on triggers.
 */
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

// --- Strategy config ------------------------------------------------------

export type ExecutionMode = 'weights' | 'orders';

export interface StrategyConfig {
  strategyName: string;
  strategyType?: string;
  initialCapital: number;
  instruments: string[];
  backtestPeriod: { start: string; end: string };
  /** Bar size for intraday templates, e.g. "1m", "15m", "1h". Daily if unset. */
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

// --- Orders ---------------------------------------------------------------

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
  /** Limit offset for stop_trail_limit orders. */
  limitOffset?: number;
  /** Absolute trailing distance. */
  trailAmount?: number;
  /** Fractional trailing distance (0.02 = 2%). */
  trailPercent?: number;
  bracket?: BracketSpec;
  /** Links two orders as a one-cancels-other pair. */
  ocoPairId?: string;
  timeInForce?: TimeInForce;
  expiresAfterBars?: number;
  tag?: string;
}

export interface PendingOrder extends Order {
  orderId: string;
  isActive: boolean;
}

/** The engine-side order book a strategy submits to. */
export interface FillEngine {
  readonly pendingOrders: readonly PendingOrder[];
  submit(order: Order): void;
  cancelAll(filter?: { instrument?: string }): void;
}

// --- Walk-forward ---------------------------------------------------------

export interface WalkForwardConfig {
  scheme: 'rolling' | 'expanding' | 'anchored';
  trainMonths: number;
  testMonths: number;
  stepMonths: number;
  /** Training days dropped next to each test window. */
  purgeDays: number;
  /** Extra purge before OOS as a fraction of the in-sample length. */
  extraPreOosPurgePct?: number;
}

/**
 * "slice_diagnostics" scores in-sample slices of one full run (indicative
 * only). "per_fold_refit" rebuilds the strategy per fold for true OOS results.
 */
export type WalkForwardMode = 'slice_diagnostics' | 'per_fold_refit';

/** Shape the engine passes to a per-fold strategy factory. */
export interface FoldWindow {
  foldId: number;
  trainStart: string;
  trainEnd: string;
  oosStart: string;
  oosEnd: string;
}
