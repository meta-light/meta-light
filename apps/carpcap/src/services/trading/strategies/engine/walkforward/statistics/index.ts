// Ported from backtester/walkforward/statistics/__init__.py (QuantJourney Backtester, Apache 2.0)

export {
  aggregateOosReturns,
  bootstrapSharpeCi,
  computeCompositeMetrics,
  type CompositeMetrics,
  type DatedSeries,
} from "./aggregation";
export {
  deflatedSharpe,
  expectedMaxSharpe,
  probabilisticSharpe,
  type DeflatedSharpeOptions,
  type ProbabilisticSharpeOptions,
} from "./deflated-sharpe";
export { interpretMetrics, type MetricVerdict, type Signal } from "./interpretation";
export { erfc, normCdf, normPpf } from "./normal";
export { aggregateEfficiency, aggregateOverfitRatio, efficiency, overfitRatio, sharpeDecay } from "./overfit";
export {
  isOosTransferDistribution,
  pboFromSelectedRanks,
  pboLogitDistribution,
  probabilityOfBacktestOverfitting,
  selectedTrialLogit,
  selectedTrialRankLogit,
  walkForwardTopKRankFailureRate,
} from "./pbo";
