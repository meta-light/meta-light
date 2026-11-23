import { type Frame, type StrategyConfig, WeightsStrategy } from '../core/index';
import { holdUntil } from '../../cycle/indicators';

// Daily stand-ins for the 200/300/350-week SMAs.
const [W200, W300, W350] = [1400, 2100, 2450];

export const config: StrategyConfig = {
  strategyName: 'WMAAccumulation',
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
  indicators: [{ function: 'SMA', priceCols: ['close'], params: { periods: [W200, W300, W350] } }],
};

/**
 * Scales into BTC as price falls through the long weekly SMAs (half below the 200W, 3/4 below the
 * 300W or 20% under the 200W, all-in below the 350W) and holds until price doubles the 200W.
 */
export class WMAAccumulation extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    const [w200, w300, w350] = [W200, W300, W350].map((p) => this.data.getFeature(`SMA_${p}_close`));
    return close.mapCols((px, c) => {
      const a = w200!.col(c);
      const b = w300!.col(c);
      const d = w350!.col(c);
      const entry = px.map((p, i) =>
        p < d[i]! ? 1 : p < b[i]! || p < 0.8 * a[i]! ? 0.75 : p < a[i]! ? 0.5 : 0,
      );
      return holdUntil(entry, px.map((p, i) => p >= 2 * a[i]!));
    });
  }

  computeWeights(): Frame {
    return this.signals;
  }
}
