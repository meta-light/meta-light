import type { WalkForwardConfig } from '../core/index';

export {
  buildConfig,
  evaluate,
  INVALID_SCORE,
  SMACrossoverTunable,
  sharpe,
} from './grid-search-optimization';

export type ParamSpace = Record<
  string,
  { type: 'int'; low: number; high: number }
>;

export type ParamConstraint = {
  type: 'less_than';
  param: string;
  than: string;
};

export interface OptunaSpec {
  paramSpace: ParamSpace;
  nTrials: number;
  sampler: 'tpe';
  pruner: 'median';
  seed: number;
  constraints: ParamConstraint[];
}

export const optunaSearch: OptunaSpec = {
  paramSpace: {
    fast: { type: 'int', low: 10, high: 80 },
    slow: { type: 'int', low: 100, high: 250 },
  },
  nTrials: 30,
  sampler: 'tpe',
  pruner: 'median',
  seed: 42,
  constraints: [{ type: 'less_than', param: 'fast', than: 'slow' }],
};

export const walkForwardConfig: WalkForwardConfig = {
  scheme: 'rolling',
  trainMonths: 24,
  testMonths: 6,
  stepMonths: 6,
  purgeDays: 5,
  extraPreOosPurgePct: 0.01,
};
