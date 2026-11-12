// Example WF 03: Anchored Walk-Forward with Purge and Embargo
//
// Mode: weights + walk-forward.
// Idea: weekly RSI(14) mean reversion (enter below 35, exit above 60),
// scored with an anchored walk-forward that drops the 10 training days
// nearest each test window and extends the pre-OOS purge by 2% of the
// in-sample length, to limit leakage across the train/test boundary.
// Universe: US sector ETFs XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY.
//
// The Python main() ran the full backtest, then a WalkForwardEngine over its
// NAV. In "slice_diagnostics" mode the folds are in-sample slices of that one
// run (indicative only); in "per_fold_refit" mode the engine rebuilds the
// strategy per fold via buildConfig() for true out-of-sample results. It then
// printed the summary and traffic-light verdicts for overfit ratio,
// efficiency and Sharpe decay. Engine runs and printing are not ported.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  type WalkForwardConfig,
  type WalkForwardMode,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function envFlag(name: string): boolean {
  return TRUTHY.has((process.env[name] ?? '').trim().toLowerCase());
}

/** QJ_WF_MODE=per_fold_refit|refit|true_oos or QJ_WF_REFIT=1 selects per-fold refits. */
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
  scheme: 'anchored',
  trainMonths: 24,
  testMonths: 6,
  stepMonths: 6,
  purgeDays: 10, // drop the 10 training days nearest the test window
  extraPreOosPurgePct: 0.02, // extend the purge before OOS by 2% of IS
};

/** Per-fold names follow `${name}_Fold01`, with backtestPeriod {trainStart, oosEnd}. */
export function buildConfig({
  strategyName = 'ExampleWF03_AnchoredPurgeEmbargo',
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
    rebalancePolicy: { frequency: 'W', weekday: 4 },
    indicators: [
      { function: 'RSI', priceCols: ['close'], params: { periods: [14] } },
    ],
  };
}

/** Weekly RSI(14) mean-reversion long/cash, walk-forward subject. */
export class RSIReversionForWF extends WeightsStrategy {
  static readonly ENTRY = 35;
  static readonly EXIT = 60;

  constructor(cfg: StrategyConfig = buildConfig()) {
    super(cfg);
  }

  computeSignals(): Frame {
    const rsi = this.data.getFeature('RSI_14_close');
    const holding = rsi.columns.map(() => false);
    return rsi.mapRows((row) =>
      row.map((value, j) => {
        if (Number.isNaN(value)) holding[j] = false;
        else if (!holding[j] && value < RSIReversionForWF.ENTRY)
          holding[j] = true;
        else if (holding[j] && value > RSIReversionForWF.EXIT)
          holding[j] = false;
        return holding[j] ? 1 : 0;
      }),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, 0.25);
  }
}
