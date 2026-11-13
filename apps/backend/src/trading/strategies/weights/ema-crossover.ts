import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, emaCrossoverScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('EMACrossover');

export class EMACrossover extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.EMA_Crossover.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) => longFlat(emaCrossoverScore(col), EMACrossover.THRESHOLD));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
