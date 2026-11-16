import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { LEGACY_SIGNALS, longFlat, liquidityScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('LiquidityBased');

export class LiquidityBased extends WeightsStrategy {
  static readonly THRESHOLD = LEGACY_SIGNALS.Liquidity_Based.threshold;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    const close = this.data.getFeature('adj_close');
    return close.mapCols((col) => longFlat(liquidityScore(col), LiquidityBased.THRESHOLD));
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
