import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, patternScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('PatternRecognition');

export class PatternRecognition extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.Pattern_Recognition.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) => longFlat(patternScore(col), PatternRecognition.THRESHOLD));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
