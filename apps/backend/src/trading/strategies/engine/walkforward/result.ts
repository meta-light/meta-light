// Ported from backtester/walkforward/result.py (QuantJourney Backtester, Apache 2.0)
//
// pandas DataFrames become arrays of row objects; Series become DatedSeries.

import type { Fold } from './folds/base';
import type { DatedSeries } from './statistics/aggregation';

export type FoldStatus = 'ok' | 'failed';
export type Row = Record<string, unknown>;

export interface FoldResult {
  readonly fold: Fold;

  readonly isSharpe: number;
  readonly isCagr: number;
  readonly isMaxDd: number;
  readonly isVolatility: number;
  readonly isNTrades: number;
  readonly isWinRate: number;
  readonly isProfitFactor: number;
  readonly isAvgHoldingDays: number;
  readonly isTurnoverAnn: number;

  readonly oosSharpe: number;
  readonly oosCagr: number;
  readonly oosMaxDd: number;
  readonly oosVolatility: number;
  readonly oosNTrades: number;
  readonly oosWinRate: number;
  readonly oosProfitFactor: number;
  readonly oosAvgHoldingDays: number;
  readonly oosTurnoverAnn: number;

  /** Daily OOS returns. */
  readonly oosReturns: DatedSeries;
  /** OOS NAV rebased to 1.0. */
  readonly oosNav: DatedSeries;

  /** IS Sharpe / OOS Sharpe. */
  readonly overfitRatio: number;
  /** OOS CAGR / IS CAGR. */
  readonly efficiency: number;
  readonly sanityWarnings: readonly string[];
  readonly fingerprint: string;
  /**
   * A failed fold (empty NAV window, refit crash) carries NaN metrics, never
   * silent zeros, and is excluded from engine aggregates.
   */
  readonly foldStatus: FoldStatus;

  // Optimization (absent when no optimizer is used)
  readonly bestParams?: Record<string, unknown> | null;
  readonly optimizerNEvals?: number | null;
  readonly optimizerBestObjective?: number | null;
  /** Completed-trial IS objective values (annualized Sharpe): the DSR trial population. */
  readonly optimizerTrialValues?: readonly number[] | null;

  /** Rolling top-K rank stability (not canonical CSCV PBO): trials' OOS objective values. */
  readonly rankStabilityCandidateOos?: readonly number[] | null;
  /** OOS rank logit of the IS-selected trial. */
  readonly rankStabilitySelectedLogit?: number | null;

  /** Cost sensitivity keyed by bps. */
  readonly costSensitivity?: Record<number, Record<string, number>> | null;
}

export type WalkForwardMode = 'slice_diagnostics' | (string & {});

export interface WalkForwardResultInit {
  folds: FoldResult[];
  /** Frozen copy of `walkForwardConfigToDict(config)`. */
  configDict: Record<string, unknown>;
  oosSharpe?: number;
  oosCagr?: number;
  oosMaxDd?: number;
  oosReturns?: DatedSeries | null;
  oosNav?: DatedSeries | null;
  sharpeCi5pct?: number | null;
  sharpeCi95pct?: number | null;
  overfitRatio?: number;
  efficiency?: number;
  sharpeDecay?: number;
  deflatedSharpe?: number | null;
  deflatedSharpeReason?: string | null;
  deflatedSharpeMethod?: string | null;
  dsrRawCompletedTrials?: number | null;
  dsrEffectiveTrials?: number | null;
  walkForwardTopKRankFailureRate?: number | null;
  rankStabilityAvailable?: boolean;
  rankStabilityReason?: string | null;
  paramStability?: Record<string, number> | null;
  paramTrajectory?: Row[] | null;
  paramJaccard?: number | null;
  costSensitivity?: Row[] | null;
  fingerprint?: string;
  warnings?: string[];
  mode?: WalkForwardMode;
}

function pct(value: number, width: number): string {
  return `${(value * 100).toFixed(1)}%`.padStart(width);
}

/** Python `{:g}` (6 significant digits, trailing zeros stripped). */
function g(value: number): string {
  return String(Number(value.toPrecision(6)));
}

/** Aggregate walk-forward result across all folds. */
export class WalkForwardResult {
  folds: FoldResult[];
  configDict: Record<string, unknown>;

  // Aggregate OOS
  oosSharpe: number;
  oosCagr: number;
  oosMaxDd: number;
  oosReturns: DatedSeries | null;
  oosNav: DatedSeries | null;
  /** Stationary-block-bootstrap CI for the composite Sharpe (seeded from config.seed). */
  sharpeCi5pct: number | null;
  sharpeCi95pct: number | null;

  // Overfitting diagnostics
  overfitRatio: number;
  efficiency: number;
  sharpeDecay: number;
  /** Probability in [0, 1]. */
  deflatedSharpe: number | null;
  /** Why DSR is unavailable (when `deflatedSharpe` is null). */
  deflatedSharpeReason: string | null;
  /**
   * `pooled_walk_forward_dsr_style` is an explicitly labelled extension: its
   * trial objectives come from multiple chronological training folds, not one
   * common trial population. With N=1 the statistic is PSR.
   */
  deflatedSharpeMethod: string | null;
  dsrRawCompletedTrials: number | null;
  dsrEffectiveTrials: number | null;
  walkForwardTopKRankFailureRate: number | null;
  rankStabilityAvailable: boolean;
  rankStabilityReason: string | null;

  // Parameter stability
  paramStability: Record<string, number> | null;
  paramTrajectory: Row[] | null;
  paramJaccard: number | null;

  // Cost sensitivity
  costSensitivity: Row[] | null;

  // Meta
  fingerprint: string;
  warnings: string[];
  mode: WalkForwardMode;

  constructor(init: WalkForwardResultInit) {
    this.folds = init.folds;
    this.configDict = init.configDict;
    this.oosSharpe = init.oosSharpe ?? 0;
    this.oosCagr = init.oosCagr ?? 0;
    this.oosMaxDd = init.oosMaxDd ?? 0;
    this.oosReturns = init.oosReturns ?? null;
    this.oosNav = init.oosNav ?? null;
    this.sharpeCi5pct = init.sharpeCi5pct ?? null;
    this.sharpeCi95pct = init.sharpeCi95pct ?? null;
    this.overfitRatio = init.overfitRatio ?? 0;
    this.efficiency = init.efficiency ?? 0;
    this.sharpeDecay = init.sharpeDecay ?? 0;
    this.deflatedSharpe = init.deflatedSharpe ?? null;
    this.deflatedSharpeReason = init.deflatedSharpeReason ?? null;
    this.deflatedSharpeMethod = init.deflatedSharpeMethod ?? null;
    this.dsrRawCompletedTrials = init.dsrRawCompletedTrials ?? null;
    this.dsrEffectiveTrials = init.dsrEffectiveTrials ?? null;
    this.walkForwardTopKRankFailureRate =
      init.walkForwardTopKRankFailureRate ?? null;
    this.rankStabilityAvailable = init.rankStabilityAvailable ?? false;
    this.rankStabilityReason = init.rankStabilityReason ?? null;
    this.paramStability = init.paramStability ?? null;
    this.paramTrajectory = init.paramTrajectory ?? null;
    this.paramJaccard = init.paramJaccard ?? null;
    this.costSensitivity = init.costSensitivity ?? null;
    this.fingerprint = init.fingerprint ?? '';
    this.warnings = init.warnings ?? [];
    this.mode = init.mode ?? 'slice_diagnostics';
  }

  get nFolds(): number {
    return this.folds.length;
  }

  /** @deprecated 0.12.x alias; this value is not canonical CSCV PBO. */
  get pbo(): number | null {
    return this.walkForwardTopKRankFailureRate;
  }

  /** @deprecated Use `rankStabilityAvailable`. */
  get pboAvailable(): boolean {
    return this.rankStabilityAvailable;
  }

  /** @deprecated Use `rankStabilityReason`. */
  get pboReason(): string | null {
    return this.rankStabilityReason;
  }

  /** One row per fold: fold_id, train/oos bounds, IS and OOS Sharpe. */
  foldBoundaries(): Row[] {
    return this.folds.map((fr) => ({
      fold_id: fr.fold.foldId,
      train_start: fr.fold.trainStart,
      train_end: fr.fold.trainEnd,
      oos_start: fr.fold.oosStart,
      oos_end: fr.fold.oosEnd,
      is_sharpe: fr.isSharpe,
      oos_sharpe: fr.oosSharpe,
    }));
  }

  /** JSON-safe dict with Python's snake_case keys (for archival / fingerprinting). */
  toDict(): Record<string, unknown> {
    const d: Record<string, unknown> = {
      n_folds: this.nFolds,
      oos_sharpe: this.oosSharpe,
      oos_cagr: this.oosCagr,
      oos_max_dd: this.oosMaxDd,
      sharpe_ci_5pct: this.sharpeCi5pct,
      sharpe_ci_95pct: this.sharpeCi95pct,
      overfit_ratio: this.overfitRatio,
      efficiency: this.efficiency,
      sharpe_decay: this.sharpeDecay,
      deflated_sharpe: this.deflatedSharpe,
      deflated_sharpe_reason: this.deflatedSharpeReason,
      deflated_sharpe_method: this.deflatedSharpeMethod,
      dsr_raw_completed_trials: this.dsrRawCompletedTrials,
      dsr_effective_trials: this.dsrEffectiveTrials,
      walk_forward_top_k_rank_failure_rate: this.walkForwardTopKRankFailureRate,
      rank_stability_available: this.rankStabilityAvailable,
      rank_stability_reason: this.rankStabilityReason,
      // Deprecated compatibility keys for 0.12.x.
      pbo: this.pbo,
      pbo_available: this.pboAvailable,
      pbo_reason: this.pboReason,
      fingerprint: this.fingerprint,
      mode: this.mode,
      warnings: this.warnings,
      config: this.configDict,
      folds: this.folds.map((fr) => ({
        fold_id: fr.fold.foldId,
        scheme: fr.fold.scheme,
        train_start: fr.fold.trainStart,
        train_end: fr.fold.trainEnd,
        oos_start: fr.fold.oosStart,
        oos_end: fr.fold.oosEnd,
        is_sharpe: fr.isSharpe,
        oos_sharpe: fr.oosSharpe,
        is_cagr: fr.isCagr,
        oos_cagr: fr.oosCagr,
        overfit_ratio: fr.overfitRatio,
        efficiency: fr.efficiency,
        best_params: fr.bestParams ?? null,
        fold_status: fr.foldStatus,
      })),
    };
    if (this.costSensitivity !== null)
      d.cost_sensitivity = this.costSensitivity;
    return d;
  }

  /** Console summary. */
  summary(): string {
    const lines: string[] = [];
    const cfg = this.configDict;
    // Accept camelCase (walkForwardConfigToDict) or Python snake_case keys.
    const scheme = String(cfg.scheme ?? '?');
    const trainM = String(cfg.trainMonths ?? cfg.train_months ?? '?');
    const testM = String(cfg.testMonths ?? cfg.test_months ?? '?');
    const sliceMode = this.mode === 'slice_diagnostics';
    const failed = this.folds.filter((fr) => fr.foldStatus !== 'ok');

    if (sliceMode) {
      lines.push('='.repeat(80));
      lines.push('IN-SAMPLE SLICE DIAGNOSTICS (not out-of-sample)');
      lines.push(
        'All metrics below are slices of ONE full-period run, NOT out-of-sample evidence.',
      );
      lines.push(
        'Pass a backtester factory to the walk-forward engine for honest per-fold refit OOS.',
      );
      lines.push('='.repeat(80));
    }
    lines.push(
      `Walk-Forward Analysis: ${this.nFolds} folds (${scheme}, ${trainM}m/${testM}m)`,
    );
    lines.push(`Fingerprint: ${this.fingerprint.slice(0, 12)}`);
    lines.push(`Mode: ${this.mode}`);
    if (failed.length > 0) {
      const ids = failed.map((fr) => String(fr.fold.foldId)).join(', ');
      lines.push(
        `⚠ ${failed.length}/${this.nFolds} FOLDS FAILED (ids: ${ids}); excluded from aggregates`,
      );
    }
    lines.push('');

    lines.push(
      `${'Fold'.padStart(4)} │ ${'IS Period'.padEnd(23)} │ ${'IS Sharpe'.padStart(9)} │ ` +
        `${'OOS Period'.padEnd(23)} │ ${'OOS Sharpe'.padStart(10)}`,
    );
    lines.push('─'.repeat(80));
    for (const fr of this.folds) {
      const f = fr.fold;
      const isPeriod = `${f.trainStart.slice(0, 7)} → ${f.trainEnd.slice(0, 7)}`;
      const oosPeriod = `${f.oosStart.slice(0, 7)} → ${f.oosEnd.slice(0, 7)}`;
      const failedTag = fr.foldStatus !== 'ok' ? '  ← FAILED' : '';
      lines.push(
        `${String(f.foldId).padStart(4)} │ ${isPeriod.padEnd(23)} │ ${fr.isSharpe.toFixed(2).padStart(9)} │ ` +
          `${oosPeriod.padEnd(23)} │ ${fr.oosSharpe.toFixed(2).padStart(10)}${failedTag}`,
      );
    }
    lines.push('─'.repeat(80));

    let srLabel: string;
    let cagrLabel: string;
    let ddLabel: string;
    if (sliceMode) {
      lines.push('AGGREGATE (IN-SAMPLE SLICES, not OOS)');
      srLabel = 'Composite Sharpe (IS slice):';
      cagrLabel = 'CAGR (IS slice):    ';
      ddLabel = 'Max DD (IS slice):  ';
    } else {
      lines.push('AGGREGATE OOS');
      srLabel = 'Composite OOS Sharpe:       ';
      cagrLabel = 'OOS CAGR:           ';
      ddLabel = 'OOS Max DD:         ';
    }
    const ci =
      this.sharpeCi5pct !== null && this.sharpeCi95pct !== null
        ? ` [5%: ${this.sharpeCi5pct.toFixed(2)}, 95%: ${this.sharpeCi95pct.toFixed(2)}]`
        : '';
    lines.push(`  ${srLabel} ${this.oosSharpe.toFixed(2)}${ci}`);
    lines.push(
      `  ${cagrLabel}  ${pct(this.oosCagr, 7)}    Overfit Ratio: ${this.overfitRatio.toFixed(2)}`,
    );
    lines.push(
      `  ${ddLabel}  ${pct(this.oosMaxDd, 7)}    Efficiency:    ${this.efficiency.toFixed(2)}`,
    );
    const decay = this.sharpeDecay.toFixed(3);
    lines.push(
      `  Sharpe Decay:         ${this.sharpeDecay >= 0 ? '+' : ''}${decay}/fold`,
    );

    if (this.deflatedSharpe !== null) {
      const dsrLabel =
        this.deflatedSharpeMethod === 'pooled_walk_forward_dsr_style'
          ? 'Pooled WF DSR-style'
          : this.deflatedSharpeMethod === 'probabilistic_sharpe_n1'
            ? 'Probabilistic Sharpe N=1'
            : 'Deflated Sharpe';
      lines.push(
        `  ${dsrLabel} (prob):${this.deflatedSharpe.toFixed(2).padStart(7)}`,
      );
      if (this.dsrRawCompletedTrials !== null) {
        const effective = this.dsrEffectiveTrials ?? this.dsrRawCompletedTrials;
        lines.push(
          `    Trials: raw completed=${this.dsrRawCompletedTrials}, effective N=${g(effective)}`,
        );
      }
    } else if (this.deflatedSharpeReason) {
      lines.push(`  Deflated Sharpe:      n/a (${this.deflatedSharpeReason})`);
    }
    const rankFailure = this.walkForwardTopKRankFailureRate;
    const rankRender = rankFailure !== null ? rankFailure.toFixed(2) : 'n/a';
    lines.push(`  WF top-K rank failure:${rankRender.padStart(8)}`);
    if (rankFailure === null && this.rankStabilityReason) {
      lines.push(`    (unavailable: ${this.rankStabilityReason})`);
    }

    if (this.warnings.length > 0) {
      lines.push('');
      lines.push('WARNINGS');
      for (const w of this.warnings) lines.push(`  ⚠ ${w}`);
    }
    return lines.join('\n');
  }
}
