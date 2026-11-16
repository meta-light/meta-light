export type {
  Objective,
  OptimizationProgress,
  OptimizeOptions,
  Optimizer,
} from './base';
export {
  GridSearchOptimizer,
  sharpeFromNav,
  type GridSearchOptions,
} from './grid';
export {
  OptimizationResult,
  type OptimizationResultInit,
  type Params,
  type TrialRecord,
  type TrialState,
} from './result';

import type { Optimizer } from './base';
import { GridSearchOptimizer } from './grid';

export function optimizerFactory(
  method: string,
  paramGrid: Record<string, readonly unknown[]> = {},
  options: { maxCombinations?: number; seed?: number } = {},
): Optimizer {
  if (method === 'grid') return new GridSearchOptimizer(paramGrid, options);
  throw new Error(`Unknown optimization method: ${JSON.stringify(method)}`);
}
