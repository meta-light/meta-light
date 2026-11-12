// Ported from backtester/walkforward/optimization/result.py (QuantJourney Backtester, Apache 2.0)
//
// Optimizer-agnostic result containers. `summary()` / `summary_dict()` live in
// Python's summary.py, which is not ported.

export type Params = Record<string, unknown>;
export type TrialState = 'COMPLETE' | 'PRUNED' | 'FAIL';

export interface TrialRecord {
  number: number;
  params: Params;
  value: number;
  /** Multi-objective values. */
  values?: number[] | null;
  /** Full metrics snapshot. */
  metrics?: Record<string, number> | null;
  durationSeconds: number;
  pruned: boolean;
  state: TrialState;
}

export interface OptimizationResultInit {
  bestParams: Params;
  bestObjective: number;
  nEvaluated: number;
  elapsedSeconds: number;
  /** One row per trial: params plus `objective`. */
  allResults?: Array<Record<string, unknown>> | null;
  trials?: TrialRecord[];
  paramImportance?: Record<string, number>;
  convergenceCurve?: number[];
  paretoFront?: Array<Record<string, unknown>>;
  /** `direction: "minimize"` flips `bestTrial` and `topK`. */
  studyMetadata?: Record<string, unknown>;
  nCompleted?: number;
  nPruned?: number;
  nFailed?: number;
  allTrialsFailed?: boolean;
  earlyStopped?: boolean;
  earlyStopReason?: string;
}

export class OptimizationResult {
  bestParams: Params;
  bestObjective: number;
  nEvaluated: number;
  elapsedSeconds: number;
  allResults: Array<Record<string, unknown>> | null;
  trials: TrialRecord[];
  paramImportance: Record<string, number>;
  convergenceCurve: number[];
  paretoFront: Array<Record<string, unknown>>;
  studyMetadata: Record<string, unknown>;
  nCompleted: number;
  nPruned: number;
  nFailed: number;
  /** Every evaluated trial failed, so `bestParams` is empty. */
  allTrialsFailed: boolean;
  earlyStopped: boolean;
  earlyStopReason: string;

  constructor(init: OptimizationResultInit) {
    this.bestParams = init.bestParams;
    this.bestObjective = init.bestObjective;
    this.nEvaluated = init.nEvaluated;
    this.elapsedSeconds = init.elapsedSeconds;
    this.allResults = init.allResults ?? null;
    this.trials = init.trials ?? [];
    this.paramImportance = init.paramImportance ?? {};
    this.convergenceCurve = init.convergenceCurve ?? [];
    this.paretoFront = init.paretoFront ?? [];
    this.studyMetadata = init.studyMetadata ?? {};
    this.nCompleted = init.nCompleted ?? 0;
    this.nPruned = init.nPruned ?? 0;
    this.nFailed = init.nFailed ?? 0;
    this.allTrialsFailed = init.allTrialsFailed ?? false;
    this.earlyStopped = init.earlyStopped ?? false;
    this.earlyStopReason = init.earlyStopReason ?? '';
  }

  private maximize(): boolean {
    return (this.studyMetadata.direction || 'maximize') !== 'minimize';
  }

  private completed(): TrialRecord[] {
    return this.trials.filter((t) => t.state === 'COMPLETE');
  }

  /** Best COMPLETE trial in the study direction (first one wins ties), or null. */
  bestTrial(): TrialRecord | null {
    const sign = this.maximize() ? 1 : -1;
    let best: TrialRecord | null = null;
    for (const t of this.completed()) {
      if (best === null || sign * t.value > sign * best.value) best = t;
    }
    return best;
  }

  /** Top `k` COMPLETE trials, best first (stable on ties). */
  topK(k = 10): TrialRecord[] {
    const sign = this.maximize() ? -1 : 1;
    return this.completed()
      .sort((a, b) => sign * (a.value - b.value) || 0)
      .slice(0, k);
  }

  toDict(): Record<string, unknown> {
    const round = (v: number, d: number): number =>
      Math.round(v * 10 ** d) / 10 ** d;
    return {
      best_params: this.bestParams,
      best_objective: this.bestObjective,
      n_evaluated: this.nEvaluated,
      n_completed: this.nCompleted,
      n_pruned: this.nPruned,
      n_failed: this.nFailed,
      all_trials_failed: this.allTrialsFailed,
      elapsed_seconds: round(this.elapsedSeconds, 2),
      early_stopped: this.earlyStopped,
      early_stop_reason: this.earlyStopReason,
      param_importance: this.paramImportance,
      convergence_curve: this.convergenceCurve,
      pareto_front: this.paretoFront,
      study_metadata: this.studyMetadata,
      trials: this.trials.map((t) => ({
        number: t.number,
        params: t.params,
        value: t.value,
        values: t.values ?? null,
        metrics: t.metrics ?? null,
        duration_seconds: round(t.durationSeconds, 3),
        pruned: t.pruned,
        state: t.state,
      })),
    };
  }
}
