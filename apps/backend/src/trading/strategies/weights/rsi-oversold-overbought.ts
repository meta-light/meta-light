// RSI(14) below 13.5 only happens in sharp capitulations, so this trades
// rarely. Kept as-is for parity; lower THRESHOLD to trade the usual 30/70.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, rsiScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('RSIOversoldOverbought');

export class RSIOversoldOverbought extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.RSI_Oversold_Overbought.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) =>
      longFlat(rsiScore(col), RSIOversoldOverbought.THRESHOLD),
    );
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
