// Ported from backtester/walkforward/folds/anchored.py (QuantJourney Backtester, Apache 2.0)
//
// IS anchored at the data start (identical to expanding for now; Python keeps it
// separate so the anchor can later become a user-specified date).

import type { ResolvedWalkForwardConfig } from '../config';
import { type Fold, type FoldScheme, generateWindowFolds } from './base';

export class AnchoredFoldScheme implements FoldScheme {
  constructor(private readonly cfg: ResolvedWalkForwardConfig) {}

  generateFolds(
    start: string,
    end: string,
    tradingDates: readonly string[],
  ): Fold[] {
    return generateWindowFolds(this.cfg, 'anchored', start, end, tradingDates);
  }
}
