// Ported from backtester/walkforward/folds/__init__.py (QuantJourney Backtester, Apache 2.0)
//
// Usage:
//   const folds = foldSchemeFactory(resolveWalkForwardConfig({ scheme: "rolling" }))
//     .generateFolds(start, end, tradingDates);

import type { ResolvedWalkForwardConfig } from '../config';
import { AnchoredFoldScheme } from './anchored';
import type { FoldScheme } from './base';
import { ExpandingFoldScheme } from './expanding';
import { RollingFoldScheme } from './rolling';

export type { Fold, FoldScheme } from './base';
export { AnchoredFoldScheme } from './anchored';
export { CPCVFoldScheme } from './cpcv';
export { ExpandingFoldScheme } from './expanding';
export {
  computePreOosPurge,
  computePurgeEmbargo,
  type PreOosPurgeArgs,
  type PurgeResult,
} from './purge';
export { RollingFoldScheme } from './rolling';

const registry = {
  rolling: RollingFoldScheme,
  expanding: ExpandingFoldScheme,
  anchored: AnchoredFoldScheme,
} as const;

/** Instantiate the fold scheme named by `config.scheme`. */
export function foldSchemeFactory(
  config: ResolvedWalkForwardConfig,
): FoldScheme {
  const Scheme = registry[config.scheme as keyof typeof registry];
  if (!Scheme) {
    throw new Error(
      `Unknown fold scheme ${JSON.stringify(config.scheme)}. Available: ${Object.keys(registry).join(', ')}`,
    );
  }
  return new Scheme(config);
}
