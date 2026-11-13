// Ported from backtester/walkforward/folds/expanding.py (QuantJourney Backtester, Apache 2.0)

import type { ResolvedWalkForwardConfig } from '../config';
import { type Fold, type FoldScheme, generateWindowFolds } from './base';

export class ExpandingFoldScheme implements FoldScheme {
  constructor(private readonly cfg: ResolvedWalkForwardConfig) {}

  generateFolds(
    start: string,
    end: string,
    tradingDates: readonly string[],
  ): Fold[] {
    return generateWindowFolds(this.cfg, 'expanding', start, end, tradingDates);
  }
}
