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

export * as execution from './execution/index';
export * as metrics from './metrics/index';
export * as portfolio from './portfolio/index';
export * as risk from './risk/index';
export * as walkforward from './walkforward/index';
