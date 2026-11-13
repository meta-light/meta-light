// Ported from backtester/walkforward/engine.py and backtester/walkforward/runner.py
// (QuantJourney Backtester, Apache 2.0)
//
// Walk-forward orchestration. Two modes:
//   slice_diagnostics: slice IS/OOS metrics out of one full-period run.
//   per_fold_refit:    for each fold, optionally grid-search params on IS
//                      (objective = IS Sharpe of a factory run), then run the
//                      factory over [trainStart, oosEnd] and slice that.
// persistence.py is not ported.

import { createHash } from 'node:crypto';
import type { Blotter } from '../metrics/index';
import {
  type ResolvedWalkForwardConfig,
  type WalkForwardOptions,
  resolveWalkForwardConfig,
  walkForwardConfigToDict,
} from './config';
import { type Fold, foldSchemeFactory } from './folds/index';
import {
  type GridSearchOptimizer,
  type OptimizationResult,
  type Params,
  sharpeFromNav,
} from './optimization/index';
import { type FoldResult, WalkForwardResult } from './result';
import {
  type DatedSeries,
  aggregateEfficiency,
  aggregateOosReturns,
  aggregateOverfitRatio,
  bootstrapSharpeCi,
  computeCompositeMetrics,
  deflatedSharpe,
  efficiency as foldEfficiency,
  overfitRatio as foldOverfitRatio,
  selectedTrialRankLogit,
  sharpeDecay,
  walkForwardTopKRankFailureRate,
} from './statistics/index';

export interface WalkForwardRun {
  dates: readonly string[];
  nav: readonly number[];
  blotter?: Blotter | null;
}

export interface FactoryArgs {
  /** Backtest period to run (inclusive, YYYY-MM-DD). */
  start: string;
  end: string;
  params: Params;
  baseConfig: Record<string, unknown>;
  /** Set for fold runs; null for optimizer objective runs. */
  fold: Fold | null;
  trainStart: string;
  trainEnd: string;
  oosStart: string | null;
  oosEnd: string | null;
}

export type BacktesterFactory = (
  args: FactoryArgs,
) => WalkForwardRun | Promise<WalkForwardRun>;

interface WindowMetrics {
  sharpe: number;
  cagr: number;
  maxDd: number;
  volatility: number;
  nTrades: number;
  winRate: number;
  profitFactor: number;
  avgHoldingDays: number;
  turnoverAnn: number;
}

const NAN_METRICS: WindowMetrics = {
  sharpe: NaN,
  cagr: NaN,
  maxDd: NaN,
  volatility: NaN,
  nTrades: 0,
  winRate: NaN,
  profitFactor: NaN,
  avgHoldingDays: NaN,
  turnoverAnn: NaN,
};

const day = (d: string): string => d.slice(0, 10);
const inWindow = (d: string, start: string, end: string): boolean =>
  day(d) >= day(start) && day(d) <= day(end);

function meanOf(xs: readonly number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stdOf(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

/** pandas Series.skew() (bias-corrected G1). */
function skewOf(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = meanOf(xs);
  const m2 = xs.reduce((s, v) => s + (v - m) ** 2, 0) / n;
  const m3 = xs.reduce((s, v) => s + (v - m) ** 3, 0) / n;
  if (m2 === 0) return 0;
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / m2 ** 1.5);
}

/** pandas Series.kurt() (bias-corrected excess kurtosis). */
function kurtOf(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 4) return NaN;
  const m = meanOf(xs);
  const m2 = xs.reduce((s, v) => s + (v - m) ** 2, 0) / n;
  const m4 = xs.reduce((s, v) => s + (v - m) ** 4, 0) / n;
  if (m2 === 0) return 0;
  const g2 = m4 / m2 ** 2 - 3;
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6);
}

/** Python json.dumps(obj, sort_keys=True) with default separators; NaN and Infinity as Python writes them. */
function pyJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pyJson).join(', ')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}: ${pyJson(obj[k])}`).join(', ')}}`;
}

const sha16 = (payload: unknown): string =>
  createHash('sha256').update(pyJson(payload)).digest('hex').slice(0, 16);

/** Return-series window [start, end] from a NAV: pct_change, slice, drop NaN. */
function windowReturns(
  run: WalkForwardRun,
  start: string,
  end: string,
): DatedSeries {
  const index: string[] = [];
  const values: number[] = [];
  for (let i = 1; i < run.nav.length; i++) {
    const d = run.dates[i]!;
    if (!inWindow(d, start, end)) continue;
    const r = run.nav[i]! / run.nav[i - 1]! - 1;
    if (Number.isNaN(r)) continue;
    index.push(d);
    values.push(r);
  }
  return { index, values };
}

export interface FoldRunnerOptions {
  factory?: BacktesterFactory | null;
  optimizer?: GridSearchOptimizer | null;
  baseConfig?: Record<string, unknown>;
  riskFreeRate?: number;
  periodsPerYear?: number;
  rankStabilityTrials?: number;
}

/** Runs one fold and builds its FoldResult (runner.py FoldRunner). */
export class FoldRunner {
  private run: WalkForwardRun | null;
  private readonly factory: BacktesterFactory | null;
  private readonly optimizer: GridSearchOptimizer | null;
  private readonly baseConfig: Record<string, unknown>;
  private readonly rf: number;
  private readonly ppy: number;
  private readonly rankStabilityTrials: number;

  constructor(
    readonly fold: Fold,
    run: WalkForwardRun | null,
    options: FoldRunnerOptions = {},
  ) {
    this.run = run;
    this.factory = options.factory ?? null;
    this.optimizer = options.optimizer ?? null;
    this.baseConfig = options.baseConfig ?? {};
    this.rf = options.riskFreeRate ?? 0;
    this.ppy = Math.max(Math.trunc(options.periodsPerYear ?? 252), 1);
    this.rankStabilityTrials = options.rankStabilityTrials ?? 0;
  }

  async execute(): Promise<FoldResult> {
    let optMeta: Partial<FoldResult> & { optimizerAllFailed?: boolean } = {};
    if (this.factory) {
      try {
        const out = await this.runRefit();
        this.run = out.run;
        optMeta = out.meta;
      } catch (err) {
        return this.failedResult(
          `refit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return this.buildResult(optMeta);
  }

  private factoryArgs(
    params: Params,
    start: string,
    end: string,
    fold: Fold | null,
  ): FactoryArgs {
    const f = this.fold;
    return {
      start,
      end,
      params,
      baseConfig: this.baseConfig,
      fold,
      trainStart: day(f.trainStart),
      trainEnd: day(f.effectiveIsEnd),
      oosStart: fold ? day(f.oosStart) : null,
      oosEnd: fold ? day(f.oosEnd) : null,
    };
  }

  private async runFoldBacktest(params: Params): Promise<WalkForwardRun> {
    const f = this.fold;
    const run = await this.factory!(
      this.factoryArgs(params, day(f.trainStart), day(f.oosEnd), f),
    );
    this.validateBounds(run);
    return run;
  }

  private validateBounds(run: WalkForwardRun): void {
    if (!run.dates.length)
      throw new Error(
        'per-fold refit produced no dated net_asset_value; fold bounds cannot be audited',
      );
    const days = run.dates.map(day).sort();
    const a = days[0]!;
    const b = days[days.length - 1]!;
    const s = day(this.fold.trainStart);
    const e = day(this.fold.oosEnd);
    if (a < s || b > e) {
      throw new Error(
        `per-fold refit escaped requested date bounds: requested [${s}, ${e}], produced [${a}, ${b}]. ` +
          'Propagate the factory train_start/oos_end strings into backtest_period.',
      );
    }
  }

  private async runRefit(): Promise<{
    run: WalkForwardRun;
    meta: Partial<FoldResult> & { optimizerAllFailed?: boolean };
  }> {
    let meta: Partial<FoldResult> & { optimizerAllFailed?: boolean } = {};
    let bestParams: Params = {};
    if (this.optimizer) {
      const f = this.fold;
      const start = day(f.trainStart);
      const end = day(f.effectiveIsEnd);
      // grid._evaluate_backtest: run IS and score sharpe of the NAV.
      const result = await this.optimizer.optimize(async (params) => {
        const run = await this.factory!(
          this.factoryArgs(params, start, end, null),
        );
        return sharpeFromNav([...run.nav], 252);
      });
      bestParams = { ...(result.bestParams ?? {}) };
      meta = {
        bestParams: Object.keys(bestParams).length ? bestParams : null,
        optimizerNEvals: result.nEvaluated,
        optimizerBestObjective: result.bestObjective,
        optimizerTrialValues: FoldRunner.trialValues(result),
        optimizerAllFailed: result.allTrialsFailed,
      };
      if (this.rankStabilityTrials >= 2) {
        const top = result.topK(this.rankStabilityTrials);
        if (top.length >= 2) {
          const scores: number[] = [];
          for (const trial of top) {
            try {
              const run = await this.runFoldBacktest({ ...trial.params });
              scores.push(
                this.windowMetrics(run, this.fold.oosStart, this.fold.oosEnd)
                  .sharpe,
              );
            } catch {
              scores.push(-Infinity);
            }
          }
          meta = {
            ...meta,
            rankStabilityCandidateOos: scores,
            rankStabilitySelectedLogit: FoldRunner.logitFromScores(scores),
          };
        }
      }
    }
    const run = await this.runFoldBacktest(bestParams);
    return { run, meta };
  }

  private static trialValues(result: OptimizationResult): number[] | null {
    const vals = result.trials
      .filter((t) => t.state === 'COMPLETE' && Number.isFinite(t.value))
      .map((t) => t.value);
    if (vals.length) return vals;
    const fromRows = (result.allResults ?? [])
      .map((r) => Number(r['objective']))
      .filter(Number.isFinite);
    return fromRows.length ? fromRows : null;
  }

  private static logitFromScores(scores: readonly number[]): number | null {
    if (!scores.length) return null;
    const selected = scores[0]!;
    const finite = scores.filter(Number.isFinite);
    if (!Number.isFinite(selected) || finite.length < 2) return NaN;
    return selectedTrialRankLogit(selected, finite);
  }

  private windowMetrics(
    run: WalkForwardRun,
    start: string,
    end: string,
  ): WindowMetrics {
    const r = windowReturns(run, start, end).values;
    if (r.length < 2) return { ...NAN_METRICS };
    const ppy = this.ppy;
    const years = r.length / ppy;
    const total = r.reduce((p, v) => p * (1 + v), 1) - 1;
    const cagr = (1 + total) ** (1 / Math.max(years, 1e-9)) - 1;
    const sd = stdOf(r);
    const vol = sd * Math.sqrt(ppy);
    const sharpe =
      sd > 0 ? ((meanOf(r) - this.rf / ppy) / sd) * Math.sqrt(ppy) : 0;
    let nav = 1;
    let peak = 1;
    let maxDd = 0;
    for (const v of r) {
      nav *= 1 + v;
      peak = Math.max(peak, nav);
      maxDd = Math.min(maxDd, (nav - peak) / peak);
    }
    let nTrades = 0;
    let turnoverAnn = NaN;
    if (run.blotter) {
      const trades = run.blotter
        .getTrades()
        .filter((t) => inWindow(t.timestamp, start, end));
      nTrades = trades.length;
      turnoverAnn = 0;
      if (nTrades > 0) {
        // No PnL column in the TS blotter, so win rate and profit factor stay NaN.
        const notional = trades.reduce((s, t) => s + Math.abs(t.tradeValue), 0);
        const navWindow = run.nav.filter((_, i) =>
          inWindow(run.dates[i]!, start, end),
        );
        const avgNav = navWindow.length ? meanOf(navWindow) : NaN;
        turnoverAnn =
          avgNav > 0 ? notional / 2 / avgNav / Math.max(years, 1e-9) : NaN;
      }
    }
    return {
      ...NAN_METRICS,
      sharpe,
      cagr,
      maxDd,
      volatility: vol,
      nTrades,
      turnoverAnn,
    };
  }

  private fingerprint(isSharpe: number, oosSharpe: number): string {
    const f = this.fold;
    return sha16({
      fold_id: f.foldId,
      scheme: f.scheme,
      train_start: f.trainStart,
      train_end: f.trainEnd,
      oos_start: f.oosStart,
      oos_end: f.oosEnd,
      is_sharpe: isSharpe,
      oos_sharpe: oosSharpe,
    });
  }

  private assemble(
    is: WindowMetrics,
    oos: WindowMetrics,
    extra: Partial<FoldResult> & {
      oosReturns: DatedSeries;
      oosNav: DatedSeries;
      overfitRatio: number;
      efficiency: number;
      sanityWarnings: string[];
      foldStatus: 'ok' | 'failed';
    },
  ): FoldResult {
    const prefixed = (p: 'is' | 'oos', m: WindowMetrics) => ({
      [`${p}Sharpe`]: m.sharpe,
      [`${p}Cagr`]: m.cagr,
      [`${p}MaxDd`]: m.maxDd,
      [`${p}Volatility`]: m.volatility,
      [`${p}NTrades`]: m.nTrades,
      [`${p}WinRate`]: m.winRate,
      [`${p}ProfitFactor`]: m.profitFactor,
      [`${p}AvgHoldingDays`]: m.avgHoldingDays,
      [`${p}TurnoverAnn`]: m.turnoverAnn,
    });
    return {
      fold: this.fold,
      ...prefixed('is', is),
      ...prefixed('oos', oos),
      fingerprint: this.fingerprint(is.sharpe, oos.sharpe),
      ...extra,
    } as FoldResult;
  }

  private failedResult(reason: string): FoldResult {
    const empty = { index: [], values: [] };
    return this.assemble(NAN_METRICS, NAN_METRICS, {
      oosReturns: empty,
      oosNav: { index: [], values: [] },
      overfitRatio: NaN,
      efficiency: NaN,
      sanityWarnings: [`Fold ${this.fold.foldId}: FAILED: ${reason}`],
      foldStatus: 'failed',
    });
  }

  private buildResult(
    meta: Partial<FoldResult> & { optimizerAllFailed?: boolean },
  ): FoldResult {
    const run = this.run!;
    const f = this.fold;
    const is = this.windowMetrics(run, f.trainStart, f.effectiveIsEnd);
    const oos = this.windowMetrics(run, f.oosStart, f.oosEnd);
    const oosReturns = windowReturns(run, f.oosStart, f.oosEnd);
    let acc = 1;
    const oosNav = {
      index: oosReturns.index.slice(),
      values: oosReturns.values.map((v) => (acc *= 1 + v)),
    };
    const failed =
      !oosReturns.values.length ||
      !Number.isFinite(oos.sharpe) ||
      !Number.isFinite(is.sharpe);
    const or = failed ? NaN : foldOverfitRatio(is.sharpe, oos.sharpe);
    const eff = failed ? NaN : foldEfficiency(is.cagr, oos.cagr);
    const warnings: string[] = [];
    const id = f.foldId;
    if (failed)
      warnings.push(
        `Fold ${id}: FAILED: empty or insufficient NAV window; metrics are NaN and the fold is excluded from aggregates`,
      );
    if (!this.factory)
      warnings.push(
        `Fold ${id}: slice diagnostics mode; metrics are sliced from the full-period NAV (no per-fold refit)`,
      );
    if (meta.optimizerAllFailed)
      warnings.push(
        `Fold ${id}: ALL optimizer trials failed; fold ran with base config (unoptimized)`,
      );
    if (oos.sharpe < 0)
      warnings.push(
        `Fold ${id}: OOS Sharpe ${oos.sharpe.toFixed(2)} is negative`,
      );
    if (or > 2.5)
      warnings.push(`Fold ${id}: overfit ratio ${or.toFixed(1)} > 2.5`);
    const { optimizerAllFailed: _drop, ...rest } = meta;
    return this.assemble(is, oos, {
      ...rest,
      oosReturns,
      oosNav,
      overfitRatio: or,
      efficiency: eff,
      sanityWarnings: warnings,
      foldStatus: failed ? 'failed' : 'ok',
    });
  }
}

export interface WalkForwardEngineOptions {
  /** Full-period run: required for slice mode, and supplies the trading calendar in refit mode. */
  run?: WalkForwardRun | null;
  /** Trading calendar when no run is given (refit mode). */
  tradingDates?: readonly string[];
  factory?: BacktesterFactory | null;
  optimizer?: GridSearchOptimizer | null;
  baseConfig?: Record<string, unknown>;
  riskFreeRate?: number;
  periodsPerYear?: number;
}

/** Walk-forward orchestrator (engine.py WalkForwardEngine). */
export class WalkForwardEngine {
  readonly config: ResolvedWalkForwardConfig;

  constructor(
    config: ResolvedWalkForwardConfig | WalkForwardOptions,
    readonly options: WalkForwardEngineOptions = {},
  ) {
    this.config =
      'rankStabilityEnabled' in config
        ? (config as ResolvedWalkForwardConfig)
        : resolveWalkForwardConfig(config);
    if (!options.factory && !options.run)
      throw new Error(
        'WalkForwardEngine needs a full-period run (slice mode) or a factory',
      );
  }

  get mode(): 'per_fold_refit' | 'slice_diagnostics' {
    return this.options.factory ? 'per_fold_refit' : 'slice_diagnostics';
  }

  private get ppy(): number {
    return Math.max(Math.trunc(this.options.periodsPerYear ?? 252), 1);
  }

  async run(): Promise<WalkForwardResult> {
    const o = this.options;
    const dates = [...(o.run?.dates ?? o.tradingDates ?? [])].sort();
    if (dates.length < 2)
      throw new Error('walk-forward needs at least 2 trading dates');
    const cfg = this.config;
    const start = dates[0]!;
    const end = dates[dates.length - 1]!;
    const folds = foldSchemeFactory(cfg).generateFolds(start, end, dates);
    if (!folds.length) {
      throw new Error(
        `No valid folds generated for ${cfg.scheme} scheme with train=${cfg.trainMonths}m, test=${cfg.testMonths}m over ${start} to ${end}`,
      );
    }
    const results: FoldResult[] = [];
    for (const fold of folds) {
      const runner = new FoldRunner(fold, o.factory ? null : o.run!, {
        factory: o.factory,
        optimizer: o.optimizer,
        baseConfig: o.baseConfig,
        riskFreeRate: o.riskFreeRate,
        periodsPerYear: this.ppy,
        rankStabilityTrials: cfg.rankStabilityEnabled
          ? cfg.resolvedRankStabilityTrials
          : 0,
      });
      results.push(await runner.execute());
    }
    return this.aggregate(results);
  }

  private aggregate(folds: FoldResult[]): WalkForwardResult {
    const cfg = this.config;
    const rf = this.options.riskFreeRate ?? 0;
    const ppy = this.ppy;
    const warnings: string[] = [];
    const ok = folds.filter((f) => f.foldStatus === 'ok');
    const failed = folds.filter((f) => f.foldStatus !== 'ok');
    if (failed.length) {
      warnings.push(
        `${failed.length}/${folds.length} folds FAILED (ids: ${failed.map((f) => f.fold.foldId).join(', ')}); excluded from aggregate metrics`,
      );
    }
    const oosList = ok.map((f) => f.oosReturns).filter((s) => s.values.length);
    const allIdx = oosList.flatMap((s) => s.index);
    if (new Set(allIdx).size !== allIdx.length) {
      warnings.push(
        'Overlapping OOS windows (step < test): duplicated dates are averaged across folds, which can bias the composite Sharpe upward; prefer step_months >= test_months',
      );
    }
    const { returns: oosReturns, nav: oosNav } = aggregateOosReturns(oosList);
    const r = oosReturns.values;
    const composite = r.length
      ? computeCompositeMetrics(r, rf, ppy)
      : { sharpe: NaN, cagr: NaN, maxDd: NaN, volatility: NaN };
    const ci = r.length
      ? bootstrapSharpeCi(r, {
          seed: cfg.seed,
          riskFreeRate: rf,
          tradingDays: ppy,
        })
      : null;

    const orVal = ok.length
      ? aggregateOverfitRatio(
          ok.map((f) => f.isSharpe),
          ok.map((f) => f.oosSharpe),
        )
      : NaN;
    const effVal = ok.length
      ? aggregateEfficiency(
          ok.map((f) => f.isCagr),
          ok.map((f) => f.oosCagr),
        )
      : NaN;
    const decay = ok.length ? sharpeDecay(ok.map((f) => f.oosSharpe)) : NaN;

    let dsr: number | null = null;
    let dsrReason: string | null = null;
    let dsrMethod: string | null = null;
    let dsrRaw: number | null = null;
    let dsrEff: number | null = null;
    if (this.mode === 'slice_diagnostics') {
      dsrReason = 'in-sample; DSR not meaningful without independent trials';
    } else if (cfg.computeDeflatedSharpe && r.length >= 3) {
      const sd = stdOf(r);
      if (sd > 0) {
        const ann = Math.sqrt(ppy);
        const srDaily = (meanOf(r) - rf / ppy) / sd;
        const pooled = ok.flatMap((f) =>
          (f.optimizerTrialValues ?? [])
            .filter(Number.isFinite)
            .map((v) => v / ann),
        );
        const optimizerUsed = ok.some((f) => !!f.optimizerNEvals);
        if (optimizerUsed && !pooled.length) {
          warnings.push(
            'DSR computed without multiple-testing deflation (N=1): optimizer was used but per-trial objective values are unavailable',
          );
        }
        dsrRaw = pooled.length || 1;
        dsrEff = cfg.dsrEffectiveNTrials ?? dsrRaw;
        dsrMethod =
          pooled.length && optimizerUsed
            ? 'pooled_walk_forward_dsr_style'
            : 'probabilistic_sharpe_n1';
        dsr = deflatedSharpe(pooled, dsrRaw, {
          effectiveNTrials: dsrEff,
          observedSr: srDaily,
          nObs: r.length,
          skewness: skewOf(r),
          kurtosis: kurtOf(r) + 3,
        });
      }
    }

    let rankRate: number | null = null;
    let rankAvailable = false;
    let rankReason: string | null = null;
    if (cfg.rankStabilityEnabled) {
      const logits = ok
        .map((f) => f.rankStabilitySelectedLogit)
        .filter((v): v is number => v != null);
      if (logits.length >= 4) {
        const rate = walkForwardTopKRankFailureRate(logits);
        if (Number.isNaN(rate))
          rankReason = 'no finite selection-rank logits across folds';
        else {
          rankRate = rate;
          rankAvailable = true;
        }
      } else if (logits.length) {
        rankReason = `only ${logits.length} folds have per-trial OOS ranks (need >= 4)`;
      } else {
        rankReason =
          'requires per-trial OOS evaluation; set WalkForwardConfig.rank_stability_trials=K (>=2) with an optimizer to evaluate top-K trials OOS per fold';
      }
      if (rankReason)
        warnings.push(`WF top-K rank failure unavailable: ${rankReason}`);
    }

    if (this.mode === 'slice_diagnostics') {
      warnings.push(
        'Walk-forward mode=slice_diagnostics: metrics are computed from a full-period NAV; pass backtester_factory for per-fold refit.',
      );
    }
    for (const f of folds) warnings.push(...f.sanityWarnings);
    if (decay < -0.05)
      warnings.push(
        'Sharpe decay slope is strongly negative; alpha may be decaying',
      );
    else if (decay < -0.01)
      warnings.push(
        'Sharpe decay slope is negative; mild alpha decay detected',
      );
    if (orVal > 2.5)
      warnings.push(
        `Aggregate overfit ratio ${orVal.toFixed(1)} > 2.5; likely overfit`,
      );
    const neg = ok.filter((f) => f.oosSharpe < cfg.minOosSharpe).length;
    if (neg > 0)
      warnings.push(
        `${neg}/${ok.length} folds have OOS Sharpe below ${cfg.minOosSharpe}`,
      );

    const configDict = walkForwardConfigToDict(cfg);
    const fingerprint = sha16({
      config: configDict,
      n_folds: folds.length,
      oos_sharpe: composite.sharpe,
      fold_fingerprints: folds.map((f) => f.fingerprint),
    });

    return new WalkForwardResult({
      folds,
      configDict,
      oosSharpe: composite.sharpe,
      oosCagr: composite.cagr,
      oosMaxDd: composite.maxDd,
      oosReturns,
      oosNav,
      sharpeCi5pct: ci ? ci[0] : null,
      sharpeCi95pct: ci ? ci[1] : null,
      overfitRatio: orVal,
      efficiency: effVal,
      sharpeDecay: decay,
      deflatedSharpe: dsr,
      deflatedSharpeReason: dsrReason,
      deflatedSharpeMethod: dsrMethod,
      dsrRawCompletedTrials: dsrRaw,
      dsrEffectiveTrials: dsrEff,
      walkForwardTopKRankFailureRate: rankRate,
      rankStabilityAvailable: rankAvailable,
      rankStabilityReason: rankReason,
      fingerprint,
      warnings,
      mode: this.mode,
    });
  }
}
