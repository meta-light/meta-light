export type Signal = 'green' | 'yellow' | 'red';

export interface MetricVerdict {
  name: string;
  value: number;
  signal: Signal;
  description: string;
}

interface Threshold {
  green: (v: number) => boolean;
  yellow: (v: number) => boolean;
  greenDesc: string;
  yellowDesc: string;
  redDesc: string;
}

const THRESHOLDS: Record<string, Threshold> = {
  overfit_ratio: {
    green: (v) => v < 1.5,
    yellow: (v) => v >= 1.5 && v <= 2.5,
    greenDesc: '< 1.5: robust',
    yellowDesc: '1.5 to 2.5: caution',
    redDesc: '> 2.5: likely overfit',
  },
  efficiency: {
    green: (v) => v > 0.7,
    yellow: (v) => v >= 0.4 && v <= 0.7,
    greenDesc: '> 0.7: robust transfer',
    yellowDesc: '0.4 to 0.7: moderate degradation',
    redDesc: '< 0.4: poor transfer',
  },
  sharpe_decay: {
    green: (v) => v > -0.01,
    yellow: (v) => v >= -0.05 && v <= -0.01,
    greenDesc: '> -0.01/fold: stable',
    yellowDesc: '-0.01 to -0.05/fold: moderate decay',
    redDesc: '< -0.05/fold: alpha decaying',
  },
  deflated_sharpe: {
    green: (v) => v >= 0.95,
    yellow: (v) => v >= 0.8 && v < 0.95,
    greenDesc: '>= 0.95: robust vs multiple testing',
    yellowDesc: '0.80 to 0.95: marginal',
    redDesc: '< 0.80: likely false positive',
  },
  breakeven_bps: {
    green: (v) => v > 20,
    yellow: (v) => v >= 10 && v <= 20,
    greenDesc: '> 20 bps: cost-robust',
    yellowDesc: '10 to 20 bps: marginal',
    redDesc: '< 10 bps: cost-fragile',
  },
};

const GATED_ON_OOS_SHARPE = new Set(['overfit_ratio', 'sharpe_decay']);
const MIN_FOLDS_FOR_VERDICT = 6;
const LOW_FOLD_METRICS = new Set(['sharpe_decay']);

function classify(name: string, value: number): [Signal, string] {
  const t = THRESHOLDS[name];
  if (!t) return ['yellow', 'no threshold defined'];
  if (t.green(value)) return ['green', t.greenDesc];
  if (t.yellow(value)) return ['yellow', t.yellowDesc];
  return ['red', t.redDesc];
}

export function interpretMetrics(
  metrics: Record<string, number | null | undefined>,
): MetricVerdict[] {
  const oosSr =
    'composite_sharpe' in metrics
      ? metrics.composite_sharpe
      : metrics.oos_sharpe;
  const losing = oosSr != null && !Number.isNaN(oosSr) && oosSr <= 0;
  const nFolds = metrics.n_folds;
  const lowFolds = nFolds != null && nFolds < MIN_FOLDS_FOR_VERDICT;

  const verdicts: MetricVerdict[] = [];
  for (const [name, value] of Object.entries(metrics)) {
    if (!(name in THRESHOLDS) || value == null || Number.isNaN(value)) continue;
    let signal: Signal;
    let description: string;
    if (GATED_ON_OOS_SHARPE.has(name) && losing) {
      signal = 'red';
      description = `OOS Sharpe <= 0: strategy loses out-of-sample; ${name} verdict suppressed (never green on a losing strategy)`;
    } else if (name === 'overfit_ratio' && value < 0) {
      signal = 'yellow';
      description =
        'ratio < 0: IS Sharpe negative; overfit ratio not interpretable';
    } else {
      [signal, description] = classify(name, value);
    }
    if (lowFolds && LOW_FOLD_METRICS.has(name))
      description = `${description} (low fold count, indicative only)`;
    verdicts.push({ name, value, signal, description });
  }
  return verdicts;
}
