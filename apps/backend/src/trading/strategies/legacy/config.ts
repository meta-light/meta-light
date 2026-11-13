// The old service traded crypto tokens; the default universe keeps that, and
// the engine runner swaps in whatever assets the caller asks for.

import type { StrategyConfig } from '../core/index';

export function legacyConfig(strategyName: string): StrategyConfig {
  return {
    strategyName,
    strategyType: 'Long / Cash',
    initialCapital: 100_000,
    instruments: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    backtestPeriod: { start: '2020-01-01', end: '2026-01-01' },
    benchmarkSymbol: 'BTC-USD',
    benchmarkName: 'Bitcoin USD',
    source: 'yfinance',
    executionMode: 'weights',
    maxPositionSize: 0.5,
    rebalancePolicy: { frequency: 'D' },
    indicators: [],
  };
}
