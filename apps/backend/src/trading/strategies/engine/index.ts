// Public API of the backtest engine (ported from QuantJourney Backtester, Apache 2.0).
//
// Subpackages are exported as namespaces because several share type names
// (e.g. PortfolioSnapshot, ContractSpecResolver in risk and portfolio).

export {
  Backtester,
  type BacktesterOptions,
  type BacktestMode,
  type BacktestResult,
  type WeightExecution,
} from './backtester';
export { BarData, type BarFetcher, type DataBar } from './data';
export {
  FoldRunner,
  WalkForwardEngine,
  type BacktesterFactory,
  type FactoryArgs,
  type WalkForwardEngineOptions,
  type WalkForwardRun,
} from './walkforward/runner';

export * as execution from '../../../services/trading/strategies/engine/execution';
export * as metrics from '../../../services/trading/strategies/engine/metrics';
export * as portfolio from '../../../services/trading/strategies/engine/portfolio';
export * as risk from '../../../services/trading/strategies/engine/risk';
export * as walkforward from '../../../services/trading/strategies/engine/walkforward';
