// Example Weights 25: Continuous Futures Trend Proxy
//
// Mode: weights (price-return research proxy).
// Idea: diversified long/short trend following over equity index, rates,
// energy, metals, and grains, with inverse-volatility weights.
// Universe: MES, MNQ, ZN, CL, GC and ZC provider continuous-futures proxies.
//
// Yahoo symbols ending in "=F" are provider-managed continuous series. This
// does not select dated contracts, control the roll rule, book roll slippage,
// apply exchange margin, or calculate multiplier-based PnL. Use it for signal
// research, not for an executable futures performance claim.

import {
  type Frame,
  isNum,
  type StrategyConfig,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';
import { unitGross } from './w23-fx-time-series-momentum';

export const config: StrategyConfig = {
  strategyName: 'ExampleWeights25_ContinuousFuturesTrend',
  strategyType: 'Long / Short Futures Proxy',
  initialCapital: 1_000_000,
  instruments: ['MES=F', 'MNQ=F', 'ZN=F', 'CL=F', 'GC=F', 'ZC=F'],
  backtestPeriod: { start: '2019-05-06', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'weights',
  rebalancePolicy: { frequency: 'BME' },
  indicators: [],
};

/** Moving-average trend signals and unit-gross inverse-vol weights. */
export function buildContinuousFuturesTrend(
  close: Frame,
  { fastWindow = 63, slowWindow = 252, volatilityWindow = 63 } = {},
): { signals: Frame; weights: Frame } {
  const fast = close.rollingMean(fastWindow);
  const slow = close.rollingMean(slowWindow);
  const signals = fast.zip(slow, (f, s) =>
    isNum(f) && isNum(s) ? Math.sign(f - s) : 0,
  );
  const volatility = close
    .pctChange()
    .rollingStd(volatilityWindow)
    .map((v) => v * Math.sqrt(252));
  const raw = signals.zip(volatility, (s, v) => s / (v === 0 ? NaN : v));
  return { signals, weights: unitGross(raw) };
}

/** Diversified trend signals on provider-managed continuous futures. */
export class ContinuousFuturesTrend extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    return buildContinuousFuturesTrend(this.data.getFeature('adj_close'))
      .signals;
  }

  computeWeights(): Frame {
    return buildContinuousFuturesTrend(this.data.getFeature('adj_close'))
      .weights;
  }
}
