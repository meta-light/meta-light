import type { OptimizationResult, Params } from './result';

export type Objective = (params: Params) => number | Promise<number>;

export interface OptimizationProgress {
  trial: number;
  total: number;
  value: number;
  best: number;
  params: Params;
  elapsed: number;
}

export interface OptimizeOptions {
  progressCallback?: (progress: OptimizationProgress) => void;
  cancelCheck?: () => boolean;
}

export interface Optimizer {
  optimize(
    objective: Objective,
    options?: OptimizeOptions,
  ): Promise<OptimizationResult>;
}
