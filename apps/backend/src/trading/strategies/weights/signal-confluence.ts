// Entry and exit gates are from the old `simple-signals-v2-backtest.ts`
// (MIN_SIGNAL_STRENGTH, MIN_SIGNAL_CONFIDENCE, MULTI_TIMEFRAME_FILTER).
// Stops, take-profits, cooldowns and top-K selection from the old backtest
// are left out; add them as a risk model if wanted.

import {
  equalWeightActive,
  type Frame,
  type StrategyConfig,
  WeightsStrategy,
} from '../core/index';
import { legacyConfig } from '../legacy/config';
import { confluenceScore } from '../legacy/signals';

export const config: StrategyConfig = legacyConfig('SignalConfluence');

export class SignalConfluence extends WeightsStrategy {
  static readonly ENTRY_SCORE = 0.1;
  static readonly EXIT_SCORE = -0.1;
  static readonly MIN_STRENGTH = 0.25;
  static readonly MIN_CONFIDENCE = 0.25;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeSignals(): Frame {
    // Raw (unadjusted) close so it stays consistent with the raw high/low.
    const close = this.data.getFeature('close');
    const high = this.data.getFeature('high');
    const low = this.data.getFeature('low');
    return close.mapCols((col, inst) => {
      const s = confluenceScore(col, high.col(inst), low.col(inst));
      let holding = false;
      return s.score.map((score, t) => {
        if (Number.isNaN(score)) holding = false;
        else if (
          !holding &&
          score > SignalConfluence.ENTRY_SCORE &&
          s.strength[t]! >= SignalConfluence.MIN_STRENGTH &&
          s.confidence[t]! >= SignalConfluence.MIN_CONFIDENCE &&
          s.aligned[t]!
        )
          holding = true;
        else if (holding && score < SignalConfluence.EXIT_SCORE) holding = false;
        return holding ? 1 : 0;
      });
    });
  }

  computeWeights(): Frame {
    return equalWeightActive(this.signals, this.config.maxPositionSize ?? 1);
  }
}
