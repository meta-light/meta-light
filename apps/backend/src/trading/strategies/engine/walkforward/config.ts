import type { WalkForwardConfig } from '../../core/index';

export type WalkForwardScheme = WalkForwardConfig['scheme'] | 'cpcv';

export interface WalkForwardOptions {
  scheme?: WalkForwardScheme;
  trainMonths?: number;
  testMonths?: number;
  minTrainMonths?: number;
  stepMonths?: number;
  nSplits?: number;
  purgeDays?: number;
  extraPreOosPurgePct?: number;
  embargoPct?: number;
  maxHoldingPeriodDays?: number;
  optimization?: Record<string, unknown>;
  computeDeflatedSharpe?: boolean;
  dsrEffectiveNTrials?: number;
  computeRankStability?: boolean;
  rankStabilityTrials?: number;
  computePbo?: boolean;
  pboNPartitions?: number;
  pboTrials?: number;
  minOosSharpe?: number;
  costSensitivityBps?: number[];
  baseSlippageModel?: unknown;
  baseCommissionScheme?: unknown;
  maxWorkers?: number;
  nJobsOptimizer?: number;
  verbose?: boolean;
  seed?: number;
}

export interface ResolvedWalkForwardConfig extends WalkForwardConfig {
  minTrainMonths: number;
  nSplits: number | null;
  embargoPct: number;
  maxHoldingPeriodDays: number | null;
  optimization: Record<string, unknown> | null;
  computeDeflatedSharpe: boolean;
  dsrEffectiveNTrials: number | null;
  computeRankStability: boolean | null;
  rankStabilityTrials: number | null;
  computePbo: boolean;
  pboNPartitions: number;
  pboTrials: number;
  minOosSharpe: number;
  costSensitivityBps: number[];
  baseSlippageModel: unknown;
  baseCommissionScheme: unknown;
  maxWorkers: number;
  nJobsOptimizer: number;
  verbose: boolean;
  seed: number;
  stepMonthsDefaulted: boolean;
  rankStabilityEnabled: boolean;
  resolvedRankStabilityTrials: number;
  resolvedExtraPreOosPurgePct: number;
}

export function resolveWalkForwardConfig(
  options: WalkForwardOptions = {},
): ResolvedWalkForwardConfig {
  const o = options;
  const scheme = o.scheme ?? 'rolling';
  const trainMonths = o.trainMonths ?? 24;
  const testMonths = o.testMonths ?? 6;
  const minTrainMonths = o.minTrainMonths ?? 12;
  const purgeDays = o.purgeDays ?? 5;
  const embargoPct = o.embargoPct ?? 0.01;
  const pboTrials = o.pboTrials ?? 0;
  const computePbo = o.computePbo ?? true;
  const rankStabilityTrials = o.rankStabilityTrials ?? null;

  if (trainMonths < 1) throw new Error('trainMonths must be >= 1');
  if (testMonths < 1) throw new Error('testMonths must be >= 1');
  if (minTrainMonths < 1) throw new Error('minTrainMonths must be >= 1');
  if (purgeDays < 0) throw new Error('purgeDays must be >= 0');
  if (!(embargoPct >= 0 && embargoPct <= 1))
    throw new Error('embargoPct must be in [0, 1]');
  if (
    o.extraPreOosPurgePct !== undefined &&
    !(o.extraPreOosPurgePct >= 0 && o.extraPreOosPurgePct <= 1)
  ) {
    throw new Error('extraPreOosPurgePct must be in [0, 1]');
  }
  if (
    o.dsrEffectiveNTrials !== undefined &&
    !(Number.isFinite(o.dsrEffectiveNTrials) && o.dsrEffectiveNTrials >= 1)
  ) {
    throw new Error('dsrEffectiveNTrials must be finite and >= 1');
  }
  if (
    rankStabilityTrials !== null &&
    (rankStabilityTrials < 0 || rankStabilityTrials === 1)
  ) {
    throw new Error('rankStabilityTrials must be 0 (disabled) or >= 2');
  }
  if (pboTrials < 0 || pboTrials === 1)
    throw new Error('pboTrials must be 0 (disabled) or >= 2');
  if (
    rankStabilityTrials !== null &&
    pboTrials !== 0 &&
    rankStabilityTrials !== pboTrials
  ) {
    throw new Error(
      'rankStabilityTrials and deprecated pboTrials disagree; set only one',
    );
  }
  if (scheme === 'cpcv') {
    throw new Error(
      "scheme 'cpcv' is not implemented yet; use rolling, expanding or anchored",
    );
  }

  const computeRankStability = o.computeRankStability ?? null;
  return {
    scheme,
    trainMonths,
    testMonths,
    stepMonths: o.stepMonths ?? testMonths,
    purgeDays,
    extraPreOosPurgePct: o.extraPreOosPurgePct,
    minTrainMonths,
    nSplits: o.nSplits ?? null,
    embargoPct,
    maxHoldingPeriodDays: o.maxHoldingPeriodDays ?? null,
    optimization: o.optimization ?? null,
    computeDeflatedSharpe: o.computeDeflatedSharpe ?? true,
    dsrEffectiveNTrials: o.dsrEffectiveNTrials ?? null,
    computeRankStability,
    rankStabilityTrials,
    computePbo,
    pboNPartitions: o.pboNPartitions ?? 16,
    pboTrials,
    minOosSharpe: o.minOosSharpe ?? 0,
    costSensitivityBps: o.costSensitivityBps ?? [0, 5, 10, 20],
    baseSlippageModel: o.baseSlippageModel ?? null,
    baseCommissionScheme: o.baseCommissionScheme ?? null,
    maxWorkers: o.maxWorkers ?? 1,
    nJobsOptimizer: o.nJobsOptimizer ?? -1,
    verbose: o.verbose ?? true,
    seed: o.seed ?? 42,
    stepMonthsDefaulted: o.stepMonths === undefined,
    rankStabilityEnabled: computeRankStability ?? computePbo,
    resolvedRankStabilityTrials: rankStabilityTrials ?? pboTrials,
    resolvedExtraPreOosPurgePct: o.extraPreOosPurgePct ?? embargoPct,
  };
}

export function walkForwardConfigToDict(
  cfg: ResolvedWalkForwardConfig,
): Record<string, unknown> {
  const className = (v: unknown): string | null =>
    v !== null && typeof v === 'object'
      ? (v.constructor?.name ?? 'Object')
      : null;
  return {
    ...cfg,
    stepMonths: cfg.stepMonthsDefaulted ? null : cfg.stepMonths,
    extraPreOosPurgePct: cfg.extraPreOosPurgePct ?? null,
    baseSlippageModel: className(cfg.baseSlippageModel),
    baseCommissionScheme: className(cfg.baseCommissionScheme),
  };
}
