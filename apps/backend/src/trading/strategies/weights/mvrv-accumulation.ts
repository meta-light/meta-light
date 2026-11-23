import { type Frame, type StrategyConfig, WeightsStrategy } from '../core/index';
import { holdUntil } from '../../cycle/indicators';

export const config: StrategyConfig = {
  strategyName: 'MVRVAccumulation',
  strategyType: 'Long / Cash',
  initialCapital: 100_000,
  instruments: ['BTC-USD'],
  backtestPeriod: { start: '2010-07-01', end: '2027-01-01' },
  benchmarkSymbol: 'BTC-USD',
  benchmarkName: 'Bitcoin buy and hold',
  source: 'coinmetrics',
  executionMode: 'weights',
  maxPositionSize: 1,
  rebalancePolicy: { frequency: 'D' },
  indicators: [],
  series: ['mvrv'],
};

/** Half in when MVRV drops under 1.2, all in under 1 (price below realized price), out above 2.5. */
export class MVRVAccumulation extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    return this.data.getFeature('mvrv').mapCols((m) =>
      holdUntil(
        m.map((v) => (v < 1 ? 1 : v < 1.2 ? 0.5 : 0)),
        m.map((v) => v > 2.5),
      ),
    );
  }

  computeWeights(): Frame {
    return this.signals;
  }
}
