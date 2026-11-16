import {
  crossAbove,
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  type WalkForwardConfig,
  type WalkForwardMode,
  WeightsStrategy,
} from '../core/index';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function envFlag(name: string): boolean {
  return TRUTHY.has((process.env[name] ?? '').trim().toLowerCase());
}

export function walkForwardMode(): WalkForwardMode {
  const raw = (process.env.QJ_WF_MODE ?? '').trim().toLowerCase();
  if (
    ['per_fold_refit', 'refit', 'true_oos'].includes(raw) ||
    envFlag('QJ_WF_REFIT')
  ) {
    return 'per_fold_refit';
  }
  return 'slice_diagnostics';
}

export const walkForwardConfig: WalkForwardConfig = {
  scheme: 'rolling',
  trainMonths: 24,
  testMonths: 6,
  stepMonths: 6,
  purgeDays: 5,
  extraPreOosPurgePct: 0.01,
};

export function buildConfig({
  strategyName = 'RollingWalkForward',
  backtestPeriod = { start: '2000-01-03', end: '2026-01-01' },
}: {
  strategyName?: string;
  backtestPeriod?: { start: string; end: string };
} = {}): StrategyConfig {
  return {
    strategyName,
    strategyType: 'Long / Cash',
    initialCapital: 100_000,
    instruments: [
      'XLB',
      'XLE',
      'XLF',
      'XLI',
      'XLK',
      'XLP',
      'XLU',
      'XLV',
      'XLY',
    ],
    backtestPeriod,
    benchmarkSymbol: 'SPY',
    benchmarkName: 'SPDR S&P 500 ETF Trust',
    source: 'yfinance',
    executionMode: 'weights',
    maxPositionSize: 0.25,
    rebalancePolicy: { frequency: 'BME' },
    indicators: [
      { function: 'SMA', priceCols: ['close'], params: { periods: [50, 200] } },
    ],
  };
}

export class SMATrendForWF extends WeightsStrategy {
  constructor(cfg: StrategyConfig = buildConfig()) {
    super(cfg);
  }

  computeSignals(): Frame {
    return crossAbove(
      this.data.getFeature('SMA_50_close'),
      this.data.getFeature('SMA_200_close'),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
