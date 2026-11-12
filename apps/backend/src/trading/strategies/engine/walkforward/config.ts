// Ported from backtester/walkforward/config.py (QuantJourney Backtester, Apache 2.0)
//
// The core `WalkForwardConfig` covers fold geometry only. Python's config also
// carries purge, optimisation, statistics, cost and execution settings, so
// this module adds `WalkForwardOptions` (every field optional, Python
// defaults) and `ResolvedWalkForwardConfig` (validated, defaults filled,
// derived values precomputed). A resolved config is a valid core config.

import type { WalkForwardConfig } from '../../../../services/trading/strategies/core';

export type WalkForwardScheme = WalkForwardConfig['scheme'] | 'cpcv';

export interface WalkForwardOptions {
  scheme?: WalkForwardScheme;
  trainMonths?: number;
  testMonths?: number;
  /** Minimum IS length; folds with fewer IS trading days are skipped. */
  minTrainMonths?: number;
  /** Defaults to `testMonths`. */
  stepMonths?: number;
  /** CPCV only (not implemented). */
  nSplits?: number;
  purgeDays?: number;
  /** Extra pre-OOS purge as a fraction of IS length. Falls back to `embargoPct`. */
  extraPreOosPurgePct?: number;
  /** @deprecated Historical alias for `extraPreOosPurgePct`. */
  embargoPct?: number;
  /** When set, purge = max(purgeDays, maxHoldingPeriodDays). */
  maxHoldingPeriodDays?: number;
  /** Optimizer settings, passed through to the runner. */
  optimization?: Record<string, unknown>;
  computeDeflatedSharpe?: boolean;
  /** Effective independent trials for DSR (finite, >= 1). */
  dsrEffectiveNTrials?: number;
  /** Defaults to `computePbo`. */
  computeRankStability?: boolean;
  /** 0 disables, otherwise >= 2. Defaults to `pboTrials`. */
  rankStabilityTrials?: number;
  /** @deprecated Use `computeRankStability`. */
  computePbo?: boolean;
  /** @deprecated Unused by the rank-stability diagnostic. */
  pboNPartitions?: number;
  /** @deprecated Use `rankStabilityTrials`. */
  pboTrials?: number;
  minOosSharpe?: number;
  costSensitivityBps?: number[];
  /** Engine slippage model instance (typed by the execution module). */
  baseSlippageModel?: unknown;
  /** Engine commission scheme instance (typed by the execution module). */
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
  // Derived (Python properties)
  /** True when `stepMonths` was not given and defaulted to `testMonths`. */
  stepMonthsDefaulted: boolean;
  rankStabilityEnabled: boolean;
  resolvedRankStabilityTrials: number;
  resolvedExtraPreOosPurgePct: number;
}

/** Apply Python defaults, validate, and precompute derived values. */
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

/** JSON-safe snapshot, like `WalkForwardConfig.to_dict()` (engine objects become class names). */
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
