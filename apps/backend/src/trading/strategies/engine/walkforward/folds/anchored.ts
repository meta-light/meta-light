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
