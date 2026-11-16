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
