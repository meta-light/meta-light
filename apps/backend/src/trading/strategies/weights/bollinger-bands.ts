// %B < -0.55 means the close is 4.2 sd below the 20-bar mean, but a point
// inside its own 20-bar window can be at most sqrt(19) = 4.36 sd away. It
// only fires after a near-flat window followed by a gap, so in practice
// this never trades. Kept as-is for parity; lower THRESHOLD to make it usable.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, bollingerScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('BollingerBands');

export class BollingerBands extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.Bollinger_Bands.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) =>
      longFlat(bollingerScore(col), BollingerBands.THRESHOLD),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
