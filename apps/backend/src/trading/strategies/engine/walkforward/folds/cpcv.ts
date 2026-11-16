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
