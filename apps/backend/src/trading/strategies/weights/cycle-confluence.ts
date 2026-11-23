import { type Frame, type StrategyConfig, WeightsStrategy } from '../core/index';
import { holdUntil, puellMultiple } from '../../cycle/indicators';

export const config: StrategyConfig = {
  strategyName: 'CycleConfluence',
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
  indicators: [{ function: 'SMA', priceCols: ['close'], params: { periods: [1400] } }],
  series: ['mvrv', 'fear_greed', 'miner_revenue'],
};

/** [value, isBottomish] per signal; NaN values are left out of the score rather than counted as "no". */
type Flag = (i: number) => [number, boolean];

/**
 * Exposure ratchets up to the share of bottom signals firing (price under the 200W SMA, MVRV < 1,
 * Puell < 0.5, Fear & Greed < 20) and is held until price doubles the 200W or MVRV tops 2.5.
 */
export class CycleConfluence extends WeightsStrategy {
  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const f = (name: string) => this.data.getFeature(name);
    const close = f('adj_close');
    return close.mapCols((px, c) => {
      const w200 = f('SMA_1400_close').col(c);
      const mvrv = f('mvrv').col(c);
      const fg = f('fear_greed').col(c);
      const puell = puellMultiple(f('miner_revenue').col(c));
      const flags: Flag[] = [
        (i) => [w200[i]!, px[i]! < w200[i]!],
        (i) => [mvrv[i]!, mvrv[i]! < 1],
        (i) => [puell[i]!, puell[i]! < 0.5],
        (i) => [fg[i]!, fg[i]! < 20],
      ];
      const score = px.map((_, i) => {
        const live = flags.map((g) => g(i)).filter(([v]) => Number.isFinite(v));
        return live.length ? live.filter(([, hit]) => hit).length / live.length : 0;
      });
      return holdUntil(score, px.map((p, i) => p >= 2 * w200[i]! || mvrv[i]! > 2.5));
    });
  }

  computeWeights(): Frame {
    return this.signals;
  }
}
