import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, meanReversionScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('MeanReversion');

export class MeanReversion extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.Mean_Reversion.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) => longFlat(meanReversionScore(col), MeanReversion.THRESHOLD));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
