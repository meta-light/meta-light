// Ported from backtester/walkforward/folds/cpcv.py (QuantJourney Backtester, Apache 2.0)
//
// Combinatorial Purged Cross-Validation: a placeholder in the Python original too.

import type { ResolvedWalkForwardConfig } from '../config';
import type { Fold, FoldScheme } from './base';

export class CPCVFoldScheme implements FoldScheme {
  constructor(private readonly cfg: ResolvedWalkForwardConfig) {}

  generateFolds(
    _start: string,
    _end: string,
    _tradingDates: readonly string[],
  ): Fold[] {
    throw new Error(
      "CPCV fold scheme is not implemented. Use 'rolling', 'expanding', or 'anchored' for now.",
    );
  }
}
