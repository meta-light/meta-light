// Uses real high/low (the old code passed close only) and, for ADX,
// standard Wilder smoothing. See ../legacy/signals.ts for all deviations.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, combinedMomentumScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('CombinedMomentum');

export class CombinedMomentum extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.Combined_Momentum.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('close');
    const high = this.data.getFeature('high');
    const low = this.data.getFeature('low');
    // Raw (unadjusted) close so it stays consistent with the raw high/low.
    return close.mapCols((col, inst) =>
      longFlat(combinedMomentumScore(col, high.col(inst), low.col(inst)), CombinedMomentum.THRESHOLD),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
