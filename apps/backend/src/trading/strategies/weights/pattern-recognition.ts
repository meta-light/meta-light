// Strength is 0.6 x min(total / 5, 1) and at most 3 patterns can fire on one
// bar (strength <= 0.36), so the old config's 0.5 threshold never triggers
// and this strategy never trades. Kept as-is for parity; lower THRESHOLD to
// make it usable.

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
