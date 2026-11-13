import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, macdScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('MACDSignal');

export class MACDSignal extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.MACD_Signal.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) => longFlat(macdScore(col), MACDSignal.THRESHOLD));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
