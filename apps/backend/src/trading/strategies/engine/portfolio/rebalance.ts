// Ported from backtester/portfolio/rebalance.py (QuantJourney Backtester, Apache 2.0)
//
// Trigger composition (OR, then gated):
//   rebalance = (Calendar OR Drift OR Tracking-Error OR Signal-change OR Risk-breaker)
//               AND Cost-gate
//
// Calendar anchors matter: the original authors measured Sharpe 0.494 with
// "BME" against 0.538 with "BMS" on the same strategy. Treat the anchor as a
// parameter to sensitivity-test.

import { Frame, type RebalancePolicy } from '../../core/index';
import { calendarFlags } from './calendar';
import {
  finiteOr0,
  reindexFrame,
  reindexSeries,
  type SeriesLike,
  stdDdof1,
} from './frame-utils';

/** When a target-weight rebalance executes. Fast accounting is always close-to-close. */
export type RebalanceAt = 'open' | 'close' | 'vwap_window';

/**
 * Core RebalancePolicy plus the Python fields the core type does not carry.
 * `frequency` also accepts "BYE", "<n>D" (every n bars), legacy "BM"/"BQ"/"BA",
 * start anchors "BMS"/"BQS"/"BYS"/"MS"/"QS"/"YS" and calendar "ME"/"QE"/"YE".
 * Omitted fields take the Python defaults (frequency "D", weekday 4, ...).
 */
export interface PortfolioRebalancePolicy extends Omit<
  Partial<RebalancePolicy>,
  'frequency'
> {
  frequency?: string | null;
  /** Informational in fast weight mode; execution-aware weights route OPEN/CLOSE fills. */
  rebalanceAt?: RebalanceAt;
  /** Exact rebalance dates; replaces the frequency schedule, other triggers still OR in. */
  calendarDates?: readonly string[];
  /** Do not cut positions entered fewer than `shortTermDays` bars ago. */
  avoidShortTermGains?: boolean;
  shortTermDays?: number;
}

export interface ResolvedRebalancePolicy {
  rebalanceAt: RebalanceAt;
  frequency: string | null;
  calendarDates?: readonly string[];
  weekday: number;
  driftThreshold: number | null;
  driftType: 'absolute' | 'relative';
  trackingErrorThreshold: number | null;
  trackingErrorWindow: number;
  rebalanceOnSignalChange: boolean;
  signalChangeThreshold: number;
  maxDrawdownTrigger: number | null;
  maxDrawdownAction: 'flatten' | 'halve';
  circuitBreakerCooldownDays: number;
  maxAnnualTurnover: number | null;
  minTradeSize: number;
  partialRebalance: boolean;
  avoidShortTermGains: boolean;
  shortTermDays: number;
}

export function resolvePolicy(
  policy: PortfolioRebalancePolicy = {},
): ResolvedRebalancePolicy {
  const driftType = policy.driftType ?? 'absolute';
  if (driftType !== 'absolute' && driftType !== 'relative') {
    throw new Error("driftType must be 'absolute' or 'relative'");
  }
  return {
    rebalanceAt: policy.rebalanceAt ?? 'close',
    frequency: policy.frequency === undefined ? 'D' : policy.frequency,
    calendarDates: policy.calendarDates,
    weekday: policy.weekday ?? 4,
    driftThreshold: policy.driftThreshold ?? null,
    driftType,
    trackingErrorThreshold: policy.trackingErrorThreshold ?? null,
    trackingErrorWindow: policy.trackingErrorWindow ?? 21,
    rebalanceOnSignalChange: policy.rebalanceOnSignalChange ?? false,
    signalChangeThreshold: policy.signalChangeThreshold ?? 0,
    maxDrawdownTrigger: policy.maxDrawdownTrigger ?? null,
    maxDrawdownAction: policy.maxDrawdownAction ?? 'flatten',
    circuitBreakerCooldownDays: policy.circuitBreakerCooldownDays ?? 5,
    maxAnnualTurnover: policy.maxAnnualTurnover ?? null,
    minTradeSize: policy.minTradeSize ?? 0,
    partialRebalance: policy.partialRebalance ?? false,
    avoidShortTermGains: policy.avoidShortTermGains ?? false,
    shortTermDays: policy.shortTermDays ?? 252,
  };
}

export const RebalancePresets = {
  DAILY: {} as PortfolioRebalancePolicy,
  WEEKLY: { frequency: 'W', weekday: 4 } as PortfolioRebalancePolicy,
  MONTHLY: { frequency: 'BME' } as PortfolioRebalancePolicy,
  QUARTERLY: { frequency: 'BQE' } as PortfolioRebalancePolicy,
  YEARLY: { frequency: 'BYE' } as PortfolioRebalancePolicy,
  MONTHLY_WITH_DRIFT: {
    frequency: 'BME',
    driftThreshold: 0.05,
  } as PortfolioRebalancePolicy,
  MONTHLY_PARTIAL: {
    frequency: 'BME',
    driftThreshold: 0.05,
    partialRebalance: true,
  } as PortfolioRebalancePolicy,
  RISK_MANAGED: {
    frequency: 'BME',
    driftThreshold: 0.05,
    maxDrawdownTrigger: -0.15,
    maxAnnualTurnover: 4.0,
  } as PortfolioRebalancePolicy,
  SIGNAL_DRIVEN: {
    frequency: null,
    rebalanceOnSignalChange: true,
    signalChangeThreshold: 0.01,
  } as PortfolioRebalancePolicy,
  TAX_AWARE_MONTHLY: {
    frequency: 'BME',
    driftThreshold: 0.05,
    avoidShortTermGains: true,
  } as PortfolioRebalancePolicy,
  /** VWAP execution remains unsupported by execution-aware weights. */
  INSTITUTIONAL: {
    frequency: 'BME',
    rebalanceAt: 'vwap_window',
    driftThreshold: 0.03,
    partialRebalance: true,
    maxAnnualTurnover: 6.0,
    avoidShortTermGains: true,
  } as PortfolioRebalancePolicy,
} as const;

/**
 * Minimum absolute delta weight for order-driven rebalances
 * (execution/simulator.py `_min_trade_weight`). Risk transitions always trade.
 */
export function minTradeWeight(
  policy: PortfolioRebalancePolicy,
  reason: string | null,
): number {
  if (reason === 'circuit_breaker' || reason === 'post_cooldown') return 0;
  return Math.max(policy.minTradeSize ?? 0, 0);
}

const clean = (w: readonly number[]): number[] => w.map(finiteOr0);

/** Implicit cash or financing sleeve: cash + sum(weights) == 1. */
export function cashSleeve(weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += finiteOr0(w);
  return 1 - total;
}

/** Drift weights by one bar of returns, keeping explicit cash as a zero-return sleeve. */
export function driftWithCash(
  weights: readonly number[],
  returns: readonly number[],
): number[] {
  const w = clean(weights);
  const grown = w.map((x, j) => x * (1 + finiteOr0(returns[j]!)));
  let den = cashSleeve(w);
  for (const g of grown) den += g;
  if (Math.abs(den) <= 1e-12) return w.map(() => 0);
  return grown.map((g) => g / den);
}

export function perAssetDrift(
  current: readonly number[],
  target: readonly number[],
  driftType: 'absolute' | 'relative',
): number[] {
  if (driftType === 'absolute')
    return current.map((c, j) => Math.abs(c - target[j]!));
  return current.map((c, j) => {
    const t = target[j]!;
    return Math.abs(t) > 1e-12 ? Math.abs(c - t) / Math.abs(t) : Math.abs(c);
  });
}

/** Rescale the traded sleeve so kept positions stay put and gross never exceeds the target's. */
export function renormalizeTradedSleeve(
  newW: number[],
  targetW: readonly number[],
  keep: readonly boolean[],
): number[] {
  if (keep.every(Boolean)) return newW;
  let targetTotal = 0;
  let keptTotal = 0;
  let targetGross = 0;
  let keptGross = 0;
  let tradedTotal = 0;
  let tradedGross = 0;
  for (let j = 0; j < targetW.length; j++) {
    targetTotal += targetW[j]!;
    targetGross += Math.abs(targetW[j]!);
    if (keep[j]) {
      keptTotal += newW[j]!;
      keptGross += Math.abs(newW[j]!);
    } else {
      tradedTotal += targetW[j]!;
      tradedGross += Math.abs(targetW[j]!);
    }
  }
  const maxGross = Math.max(targetGross - keptGross, 0);
  if (Math.abs(targetTotal) > 1e-12 && Math.abs(tradedTotal) > 1e-12) {
    // Net-preserving scale, clamped at 0 so a heavy kept sleeve cannot flip signs,
    // then capped so a near-neutral traded sleeve cannot blow up gross.
    let scale = Math.max((targetTotal - keptTotal) / tradedTotal, 0);
    if (tradedGross > 1e-12 && scale * tradedGross > maxGross + 1e-12)
      scale = maxGross / tradedGross;
    for (let j = 0; j < targetW.length; j++)
      if (!keep[j]) newW[j] = targetW[j]! * scale;
    return newW;
  }
  if (tradedGross > 1e-12) {
    for (let j = 0; j < targetW.length; j++)
      if (!keep[j]) newW[j] = targetW[j]! * (maxGross / tradedGross);
  }
  return newW;
}

/** Snap to target without trading instruments that lack a price on this bar. */
export function rebalanceWithFrozenUnavailable(
  targetW: readonly number[],
  currentW: readonly number[],
  available: readonly boolean[],
): number[] {
  const target = clean(targetW);
  if (available.every(Boolean)) return target;
  const current = clean(currentW);
  const keep = available.map((a) => !a);
  const newW = target.map((t, j) => (keep[j] ? current[j]! : t));
  return renormalizeTradedSleeve(newW, target, keep);
}

const dot = (a: readonly number[], b: readonly number[]): number => {
  let s = 0;
  for (let j = 0; j < a.length; j++) s += a[j]! * b[j]!;
  return s;
};

const absDiffSum = (a: readonly number[], b: readonly number[]): number => {
  let s = 0;
  for (let j = 0; j < a.length; j++) s += Math.abs(a[j]! - b[j]!);
  return s;
};

const ringSum = (ring: readonly number[]): number =>
  ring.reduce((acc, v) => acc + v, 0);

/** deque(maxlen=252) append. */
function pushRing(ring: number[], value: number, maxlen = 252): void {
  ring.push(value);
  if (ring.length > maxlen) ring.shift();
}

export interface RebalanceStats {
  rebalance_count: number;
  calendar_count: number;
  drift_count: number;
  tracking_error_count: number;
  signal_count: number;
  circuit_breaker_count: number;
  partial_positions_saved: number;
  rolling_turnover_used: number;
  rebalance_pct: number;
  avg_days_between: number;
  fast_path?: boolean;
}

export interface RebalanceResult {
  /** Realised weights after each bar's close (drifted between rebalances). */
  actualWeights: Frame;
  /** Weights held into each bar, the basis for that bar's PnL. */
  returnWeights: Frame;
  rebalanceFlags: boolean[];
  /** Asset returns aligned to the target, missing values as 0. */
  accountingReturns: Frame;
  portfolioReturns: number[];
  relativeNav: number[];
  stats: RebalanceStats | Record<string, never>;
}

export interface RebalanceEngineOptions {
  periodsPerYear?: number;
  warnUnsupported?: boolean;
}

/**
 * Targets are assumed already shifted for look-ahead. Missing asset returns
 * mark the asset untradeable for that bar: its weight is frozen and earns 0.
 */
export class RebalanceEngine {
  readonly policy: ResolvedRebalancePolicy;
  readonly periodsPerYear: number;
  /** Python UserWarnings, collected instead of printed. */
  readonly warnings: string[] = [];

  constructor(
    policy: PortfolioRebalancePolicy = {},
    options: RebalanceEngineOptions = {},
  ) {
    this.policy = resolvePolicy(policy);
    this.periodsPerYear = Math.max(
      Math.trunc(options.periodsPerYear ?? 252),
      1,
    );
    if (options.warnUnsupported ?? true) {
      if (this.policy.rebalanceAt !== 'close') {
        this.warnings.push(
          `rebalanceAt=${this.policy.rebalanceAt} is not honored by fast weight accounting, ` +
            'which remains next-bar close-to-close. Use order execution for OPEN timing; ' +
            'VWAP_WINDOW is not implemented.',
        );
      }
      if (this.policy.minTradeSize) {
        this.warnings.push(
          `minTradeSize=${this.policy.minTradeSize} is not implemented in fast weight accounting. ` +
            'It is enforced as a minimum delta weight by order execution (see minTradeWeight).',
        );
      }
    }
  }

  isSimplePolicy(): boolean {
    const p = this.policy;
    return (
      p.driftThreshold === null &&
      p.trackingErrorThreshold === null &&
      !p.rebalanceOnSignalChange &&
      p.maxDrawdownTrigger === null &&
      p.maxAnnualTurnover === null &&
      !p.partialRebalance &&
      !p.avoidShortTermGains
    );
  }

  calendarFlags(dates: readonly string[]): boolean[] {
    return calendarFlags(dates, {
      frequency: this.policy.frequency,
      weekday: this.policy.weekday,
      calendarDates: this.policy.calendarDates,
    });
  }

  /** Rows whose max absolute target change exceeds the threshold (NaN-skipping). */
  signalChangeFlags(weights: Frame): boolean[] {
    const n = weights.index.length;
    if (!this.policy.rebalanceOnSignalChange)
      return new Array<boolean>(n).fill(false);
    return weights.values.map((row, i) => {
      if (i === 0) return false;
      let max = NaN;
      row.forEach((v, j) => {
        const d = Math.abs(v - weights.values[i - 1]![j]!);
        if (!Number.isNaN(d) && (Number.isNaN(max) || d > max)) max = d;
      });
      return max > this.policy.signalChangeThreshold;
    });
  }

  run(
    targetWeights: Frame,
    assetReturns: Frame,
    benchmarkReturns?: SeriesLike,
  ): RebalanceResult {
    const dates = targetWeights.index;
    const instruments = targetWeights.columns;
    const n = dates.length;
    const m = instruments.length;
    if (n === 0) {
      const empty = new Frame(dates, instruments, []);
      return {
        actualWeights: empty,
        returnWeights: empty,
        rebalanceFlags: [],
        accountingReturns: empty,
        portfolioReturns: [],
        relativeNav: [],
        stats: {},
      };
    }

    const returns = reindexFrame(assetReturns, dates, instruments);
    const available = returns.values.map((row) =>
      row.map((v) => !Number.isNaN(v)),
    );
    if (n > 1) {
      const frozenTail = instruments.filter(
        (_, j) => available.some((row) => row[j]) && !available[n - 1]![j],
      );
      if (frozenTail.length) {
        this.warnings.push(
          `Rebalance: ${frozenTail.join(', ')} have no price through the end of the sample; ` +
            'weight held frozen at the last valid mark (possible delisting).',
        );
      }
    }
    const target = targetWeights.values.map(clean);
    const ret = returns.values.map((row) =>
      row.map((v) => (Number.isNaN(v) ? 0 : v)),
    );

    if (this.isSimplePolicy())
      return this.runVectorized(targetWeights, target, ret, available);

    const calFlags = this.calendarFlags(dates);
    const sigFlags = this.signalChangeFlags(targetWeights);
    const p = this.policy;

    const actualW: number[][] = dates.map(() => new Array<number>(m).fill(0));
    const returnW: number[][] = dates.map(() => new Array<number>(m).fill(0));
    const rebal = new Array<boolean>(n).fill(false);
    const nav = new Array<number>(n).fill(1);
    const barReturns = new Array<number>(n).fill(0);
    const bench =
      benchmarkReturns === undefined
        ? null
        : reindexSeries(benchmarkReturns, dates).map((v) =>
            Number.isNaN(v) ? 0 : v,
          );

    let current = new Array<number>(m).fill(0);
    let peakNav = 1;
    let cbActive = false;
    let cbCooldownLeft = 0;
    let forceRebalNext = false;
    const ring: number[] = [];
    const entryBar = new Array<number>(m).fill(-9999);

    let calCount = 0;
    let driftCount = 0;
    let teCount = 0;
    let sigCount = 0;
    let cbCount = 0;
    let partialSaved = 0;

    for (let i = 0; i < n; i++) {
      let shouldRebal = false;
      let trigger: string | null = null;

      // L4: circuit breaker. Skipped on the forced re-entry bar so a stale
      // drawdown does not re-trigger forever while flat.
      if (
        p.maxDrawdownTrigger !== null &&
        !cbActive &&
        !forceRebalNext &&
        i > 0
      ) {
        const dd = nav[i - 1]! / peakNav - 1;
        if (dd < p.maxDrawdownTrigger) {
          cbActive = true;
          cbCooldownLeft = p.circuitBreakerCooldownDays;
          cbCount++;
          const prev = current.slice();
          if (p.maxDrawdownAction === 'flatten')
            current = new Array<number>(m).fill(0);
          else current = current.map((w) => w * 0.5);
          // Executes at the close: the day's PnL is booked on the weights held into the bar.
          returnW[i] = prev;
          actualW[i] = current;
          rebal[i] = true;
          pushRing(ring, absDiffSum(current, prev));
          const dayRet = dot(prev, ret[i]!);
          barReturns[i] = dayRet;
          nav[i] = nav[i - 1]! * (1 + dayRet);
          peakNav = Math.max(peakNav, nav[i]!);
          continue;
        }
      }

      if (cbActive) {
        cbCooldownLeft--;
        if (cbCooldownLeft <= 0) {
          cbActive = false;
          forceRebalNext = true;
        }
        returnW[i] = current.slice();
        actualW[i] = current.slice();
        pushRing(ring, 0);
        const dayRet = dot(current, ret[i]!);
        barReturns[i] = dayRet;
        nav[i] = i > 0 ? nav[i - 1]! * (1 + dayRet) : 1;
        peakNav = Math.max(peakNav, nav[i]!);
        continue;
      }

      if (forceRebalNext) {
        shouldRebal = true;
        trigger = 'post_cooldown';
        // Reset the drawdown reference so only a new drawdown re-triggers.
        peakNav = i > 0 ? nav[i - 1]! : 1;
      }
      if (!shouldRebal && calFlags[i]) {
        shouldRebal = true;
        trigger = 'calendar';
      }
      if (!shouldRebal && sigFlags[i]) {
        shouldRebal = true;
        trigger = 'signal';
      }
      if (!shouldRebal && p.driftThreshold !== null && i > 0) {
        const drift = perAssetDrift(current, target[i]!, p.driftType);
        if (Math.max(...drift) > p.driftThreshold) {
          shouldRebal = true;
          trigger = 'drift';
        }
      }
      if (
        !shouldRebal &&
        p.trackingErrorThreshold !== null &&
        bench !== null &&
        i >= p.trackingErrorWindow
      ) {
        const w = p.trackingErrorWindow;
        const active: number[] = [];
        for (let k = i - w; k < i; k++) active.push(barReturns[k]! - bench[k]!);
        const te = stdDdof1(active) * Math.sqrt(this.periodsPerYear);
        if (te > p.trackingErrorThreshold) {
          shouldRebal = true;
          trigger = 'tracking_error';
        }
      }

      // Trades execute at the close, so a rebalance bar's PnL accrues on the pre-trade weights.
      const preRebal = current.slice();

      if (shouldRebal || i === 0) {
        const feasible = rebalanceWithFrozenUnavailable(
          target[i]!,
          current,
          available[i]!,
        );
        const tradeTurnover = absDiffSum(feasible, current);
        if (shouldRebal && p.maxAnnualTurnover !== null && i > 0) {
          if (ringSum(ring) + tradeTurnover > p.maxAnnualTurnover)
            shouldRebal = false;
        }

        if (shouldRebal || i === 0) {
          let newW = feasible.slice();

          if (p.partialRebalance && p.driftThreshold !== null && i > 0) {
            const drift = perAssetDrift(current, newW, p.driftType);
            const keep = drift.map((d) => d <= p.driftThreshold!);
            keep.forEach((k, j) => {
              if (k) newW[j] = current[j]!;
            });
            partialSaved += keep.filter(Boolean).length;
            newW = renormalizeTradedSleeve(newW, target[i]!, keep);
          }

          if (p.avoidShortTermGains && i > 0) {
            const keep = new Array<boolean>(m).fill(false);
            for (let j = 0; j < m; j++) {
              // Reducing magnitude (selling a long or covering a short).
              if (
                Math.abs(newW[j]!) < Math.abs(current[j]!) - 1e-12 &&
                i - entryBar[j]! < p.shortTermDays
              ) {
                newW[j] = current[j]!;
                keep[j] = true;
              }
            }
            if (keep.some(Boolean))
              newW = renormalizeTradedSleeve(newW, target[i]!, keep);
          }

          pushRing(ring, absDiffSum(newW, current));

          for (let j = 0; j < m; j++) {
            const oldW = current[j]!;
            const nw = newW[j]!;
            const entered = Math.abs(oldW) <= 1e-9 && Math.abs(nw) > 1e-9;
            const reversed =
              Math.abs(oldW) > 1e-9 &&
              Math.abs(nw) > 1e-9 &&
              Math.sign(oldW) !== Math.sign(nw);
            const increased =
              Math.sign(oldW) === Math.sign(nw) &&
              Math.abs(nw) > Math.abs(oldW) + 1e-9;
            if (entered || reversed || increased) entryBar[j] = i;
          }

          current = newW;
          rebal[i] = true;
          // Count only executed rebalances so sub-counters reconcile with rebalance_count.
          if (trigger === 'calendar' || trigger === 'post_cooldown') calCount++;
          else if (trigger === 'signal') sigCount++;
          else if (trigger === 'drift') driftCount++;
          else if (trigger === 'tracking_error') teCount++;
          if (trigger === 'post_cooldown') forceRebalNext = false;
        } else {
          pushRing(ring, 0);
        }
      } else {
        pushRing(ring, 0);
      }

      const periodW = clean(rebal[i] ? preRebal : current);
      returnW[i] = periodW;
      const dayRet = dot(periodW, ret[i]!);
      barReturns[i] = dayRet;
      nav[i] = i > 0 ? nav[i - 1]! * (1 + dayRet) : 1;
      peakNav = Math.max(peakNav, nav[i]!);

      if (!rebal[i] && i > 0) current = driftWithCash(periodW, ret[i]!);
      actualW[i] = current.slice();
    }

    const rebalCount = rebal.filter(Boolean).length;
    return this.result(targetWeights, actualW, returnW, rebal, ret, {
      rebalance_count: rebalCount,
      calendar_count: calCount,
      drift_count: driftCount,
      tracking_error_count: teCount,
      signal_count: sigCount,
      circuit_breaker_count: cbCount,
      partial_positions_saved: partialSaved,
      rolling_turnover_used: ringSum(ring),
      rebalance_pct: rebalCount / Math.max(n, 1),
      avg_days_between: n / Math.max(rebalCount, 1),
    });
  }

  /** Calendar-only policies: drift each segment between rebalances with a cumulative product. */
  private runVectorized(
    targetWeights: Frame,
    target: number[][],
    ret: number[][],
    available: boolean[][],
  ): RebalanceResult {
    const n = target.length;
    const m = targetWeights.columns.length;
    const flags = this.calendarFlags(targetWeights.index);
    flags[0] = true;
    const starts = flags.flatMap((f, i) => (f ? [i] : []));
    const actualW: number[][] = new Array(n);
    const returnW: number[][] = new Array(n);

    // Weights held INTO the segment-start bar (cash before the first rebalance).
    let carry = new Array<number>(m).fill(0);
    starts.forEach((start, s) => {
      const end = s + 1 < starts.length ? starts[s + 1]! : n;
      const w0 = rebalanceWithFrozenUnavailable(
        target[start]!,
        carry,
        available[start]!,
      );
      returnW[start] = clean(carry);
      actualW[start] = w0;
      if (end - start <= 1) {
        carry = w0;
        return;
      }
      let allAvailable = true;
      for (let k = start + 1; k < end && allAvailable; k++)
        allAvailable = available[k]!.every(Boolean);
      if (!allAvailable) {
        let cur = w0.slice();
        for (let k = start + 1; k < end; k++) {
          const periodW = clean(cur);
          returnW[k] = periodW;
          cur = driftWithCash(periodW, ret[k]!);
          actualW[k] = cur;
        }
        carry = cur;
        return;
      }
      const cash = cashSleeve(w0);
      const growth = new Array<number>(m).fill(1);
      let prev = w0;
      for (let k = start + 1; k < end; k++) {
        const row = ret[k]!;
        for (let j = 0; j < m; j++) growth[j] = growth[j]! * (1 + row[j]!);
        const drifted = w0.map((w, j) => w * growth[j]!);
        let den = cash;
        for (const d of drifted) den += d;
        if (!(Math.abs(den) > 1e-12)) den = 1;
        const out = drifted.map((d) => d / den);
        actualW[k] = out;
        returnW[k] = prev;
        prev = out;
      }
      carry = prev;
    });

    const rebalCount = starts.length;
    return this.result(targetWeights, actualW, returnW, flags, ret, {
      rebalance_count: rebalCount,
      calendar_count: rebalCount,
      drift_count: 0,
      tracking_error_count: 0,
      signal_count: 0,
      circuit_breaker_count: 0,
      partial_positions_saved: 0,
      rolling_turnover_used: 0,
      rebalance_pct: rebalCount / Math.max(n, 1),
      avg_days_between: n / Math.max(rebalCount, 1),
      fast_path: true,
    });
  }

  private result(
    targetWeights: Frame,
    actualW: number[][],
    returnW: number[][],
    flags: boolean[],
    ret: number[][],
    stats: RebalanceStats,
  ): RebalanceResult {
    const { index, columns } = targetWeights;
    const portfolioReturns = returnW.map((w, i) =>
      w.reduce((acc, x, j) => acc + x * ret[i]![j]!, 0),
    );
    let acc = 1;
    return {
      actualWeights: new Frame(index, columns, actualW),
      returnWeights: new Frame(index, columns, returnW),
      rebalanceFlags: flags,
      accountingReturns: new Frame(index, columns, ret),
      portfolioReturns,
      relativeNav: portfolioReturns.map((r) => (acc *= 1 + r)),
      stats,
    };
  }
}

// ── Execution-aware evaluator ─────────────────────────────────────────────

export type RebalanceReason =
  | 'initial'
  | 'calendar'
  | 'signal'
  | 'drift'
  | 'tracking_error'
  | 'circuit_breaker'
  | 'post_cooldown';

export interface ExecutionRebalanceDecision {
  shouldRebalance: boolean;
  decisionTime: string;
  executionTime: string | null;
  reason: RebalanceReason | null;
  desiredWeights: Record<string, number>;
  persistentWeights: Record<string, number>;
  proposedTurnover: number;
}

export interface ExecutionRebalanceStats {
  decision_count: number;
  rebalance_count: number;
  avg_days_between: number;
  execution_day_count: number;
  submitted_order_count: number;
  rejected_order_count: number;
  fill_count: number;
  calendar_count: number;
  drift_count: number;
  tracking_error_count: number;
  signal_count: number;
  circuit_breaker_count: number;
  post_cooldown_count: number;
  turnover_veto_count: number;
  partial_positions_saved: number;
}

export interface ExecutionRebalanceEngineOptions {
  dates: readonly string[];
  instruments: readonly string[];
  periodsPerYear?: number;
  benchmarkReturns?: SeriesLike;
}

export interface EvaluateInput {
  barIndex: number;
  decisionTime: string;
  /** Next bar's timestamp; null on the last bar (observe only). */
  executionTime: string | null;
  targetWeights: Record<string, number>;
  realizedWeights: Record<string, number>;
  positions: Record<string, number>;
  nav: number;
  available: Record<string, boolean>;
}

/**
 * Stateful policy evaluator driven by realized ledger state. Unlike
 * RebalanceEngine.run it never assumes an ideal snap to target: decisions
 * use the positions, fills, NAV and exposure weights the ledger observed.
 */
export class ExecutionRebalanceEngine {
  readonly policy: ResolvedRebalancePolicy;
  readonly dates: readonly string[];
  readonly instruments: readonly string[];
  readonly periodsPerYear: number;

  decisionFlags: boolean[] = [];
  plannedExecutionFlags: boolean[] = [];
  submissionFlags: boolean[] = [];
  fillFlags: boolean[] = [];
  stats!: ExecutionRebalanceStats;

  private readonly datePos: Map<string, number>;
  private readonly calFlags: boolean[];
  private readonly benchmark: Map<string, number> | null;

  private previousTarget: number[] | null = null;
  private previousPositions: number[] = [];
  private entryBar: number[] = [];
  private previousNav: number | null = null;
  private peakNav: number | null = null;
  private portfolioReturns: number[] = [];
  private returnDates: string[] = [];
  private ring: number[] = [];
  private barExecutedTurnover = 0;
  private cbActive = false;
  private cbCooldownLeft = 0;
  private forceReentry = false;
  private circuitBreakerExitPending = false;
  private reentryPending = false;

  constructor(
    policy: PortfolioRebalancePolicy,
    options: ExecutionRebalanceEngineOptions,
  ) {
    this.policy = resolvePolicy(policy);
    this.dates = options.dates.slice();
    this.instruments = options.instruments.slice();
    this.periodsPerYear = Math.max(
      Math.trunc(options.periodsPerYear ?? 252),
      1,
    );
    this.datePos = new Map(this.dates.map((d, i) => [d, i] as const));
    this.calFlags = new RebalanceEngine(policy, {
      periodsPerYear: this.periodsPerYear,
      warnUnsupported: false,
    }).calendarFlags(this.dates);
    const bench = options.benchmarkReturns;
    if (bench === undefined) {
      this.benchmark = null;
    } else {
      const aligned = reindexSeries(bench, this.dates);
      this.benchmark = new Map(
        this.dates.map(
          (d, i) => [d, Number.isNaN(aligned[i]!) ? 0 : aligned[i]!] as const,
        ),
      );
    }
    this.reset();
  }

  reset(): void {
    const m = this.instruments.length;
    const n = this.dates.length;
    this.previousTarget = null;
    this.previousPositions = new Array<number>(m).fill(0);
    this.entryBar = new Array<number>(m).fill(-9999);
    this.previousNav = null;
    this.peakNav = null;
    this.portfolioReturns = [];
    this.returnDates = [];
    this.ring = [];
    this.barExecutedTurnover = 0;
    this.cbActive = false;
    this.cbCooldownLeft = 0;
    this.forceReentry = false;
    this.circuitBreakerExitPending = false;
    this.reentryPending = false;
    this.decisionFlags = new Array<boolean>(n).fill(false);
    this.plannedExecutionFlags = new Array<boolean>(n).fill(false);
    this.submissionFlags = new Array<boolean>(n).fill(false);
    this.fillFlags = new Array<boolean>(n).fill(false);
    this.stats = {
      decision_count: 0,
      rebalance_count: 0,
      avg_days_between: 0,
      execution_day_count: 0,
      submitted_order_count: 0,
      rejected_order_count: 0,
      fill_count: 0,
      calendar_count: 0,
      drift_count: 0,
      tracking_error_count: 0,
      signal_count: 0,
      circuit_breaker_count: 0,
      post_cooldown_count: 0,
      turnover_veto_count: 0,
      partial_positions_saved: 0,
    };
  }

  /** Record realized turnover and fill-date observability. */
  recordFill({
    timestamp,
    notional,
    nav,
  }: {
    timestamp: string;
    notional: number;
    nav: number;
  }): void {
    if (Math.abs(nav) > 1e-12)
      this.barExecutedTurnover += Math.abs(notional) / Math.abs(nav);
    const pos = this.datePos.get(timestamp);
    if (pos !== undefined) {
      if (!this.fillFlags[pos]) this.stats.execution_day_count++;
      this.fillFlags[pos] = true;
    }
    this.stats.fill_count++;
  }

  recordSubmission({
    timestamp,
    submitted,
    rejected,
    reason = null,
  }: {
    timestamp: string;
    submitted: number;
    rejected: number;
    reason?: string | null;
  }): void {
    if (submitted) {
      const pos = this.datePos.get(timestamp);
      if (pos !== undefined) {
        this.submissionFlags[pos] = true;
        const positions = this.submissionFlags.flatMap((f, i) =>
          f ? [i] : [],
        );
        this.stats.avg_days_between =
          positions.length > 1
            ? (positions[positions.length - 1]! - positions[0]!) /
              (positions.length - 1)
            : 0;
      }
      this.stats.rebalance_count++;
    }
    this.stats.submitted_order_count += Math.trunc(submitted);
    this.stats.rejected_order_count += Math.trunc(rejected);
    if (reason === 'circuit_breaker') {
      if (submitted) this.circuitBreakerExitPending = true;
    } else if (reason === 'post_cooldown' && submitted) {
      this.reentryPending = true;
    }
  }

  /** Commit risk-state transitions once the executable target is met. */
  recordTargetReconciled({ reason }: { reason: string | null }): void {
    if (reason === 'circuit_breaker') {
      this.circuitBreakerExitPending = false;
      this.cbActive = true;
      this.cbCooldownLeft = Math.max(
        Math.trunc(this.policy.circuitBreakerCooldownDays),
        1,
      );
    } else if (reason === 'post_cooldown') {
      this.reentryPending = false;
      this.forceReentry = false;
    }
  }

  /** Evaluate the policy after `decisionTime` for next-bar execution. */
  evaluate(input: EvaluateInput): ExecutionRebalanceDecision {
    const { barIndex, decisionTime, executionTime, positions, nav } = input;
    if (executionTime === null) {
      this.startBarObservation(barIndex, decisionTime, positions, nav);
      this.finishObservation(this.vector(input.targetWeights), positions, nav);
      return this.noDecision(input);
    }
    const target = this.vector(input.targetWeights);
    const current = this.vector(input.realizedWeights);
    const availability = this.instruments.map((s) =>
      Boolean(input.available[s] ?? false),
    );
    this.startBarObservation(barIndex, decisionTime, positions, nav);

    if (this.circuitBreakerExitPending || this.reentryPending) {
      this.finishObservation(target, positions, nav);
      return this.noDecision(input);
    }
    if (this.cbActive) {
      this.cbCooldownLeft--;
      if (this.cbCooldownLeft <= 0) {
        this.cbActive = false;
        this.forceReentry = true;
      } else {
        this.finishObservation(target, positions, nav);
        return this.noDecision(input);
      }
    }

    let reason: RebalanceReason | null = null;
    let desired = target.slice();
    if (this.forceReentry) {
      reason = 'post_cooldown';
      this.peakNav = nav;
    } else if (this.drawdownBreached(nav)) {
      reason = 'circuit_breaker';
      desired =
        this.policy.maxDrawdownAction === 'flatten'
          ? current.map(() => 0)
          : current.map((w) => w * 0.5);
    } else if (barIndex === 0) reason = 'initial';
    else if (this.calendarDue(executionTime)) reason = 'calendar';
    else if (this.signalChanged(target)) reason = 'signal';
    else if (this.driftBreached(current, target)) reason = 'drift';
    else if (this.trackingErrorBreached()) reason = 'tracking_error';

    if (reason === null) {
      this.finishObservation(target, positions, nav);
      return this.noDecision(input);
    }

    const riskTransition =
      reason === 'circuit_breaker' || reason === 'post_cooldown';
    if (!riskTransition) {
      desired = this.applyPartialRebalance(current, desired, target, barIndex);
      desired = this.applyTaxHeuristic(current, desired, target, barIndex);
    }
    const persistent = desired.slice();
    desired = rebalanceWithFrozenUnavailable(desired, current, availability);
    const proposedTurnover = absDiffSum(desired, current);
    const maxTurnover = this.policy.maxAnnualTurnover;
    if (
      !riskTransition &&
      barIndex > 0 &&
      maxTurnover !== null &&
      ringSum(this.ring) + proposedTurnover > maxTurnover + 1e-12
    ) {
      this.stats.turnover_veto_count++;
      this.finishObservation(target, positions, nav);
      return this.noDecision(input);
    }

    const dPos = this.datePos.get(decisionTime);
    if (dPos !== undefined) this.decisionFlags[dPos] = true;
    const ePos = this.datePos.get(executionTime);
    if (ePos !== undefined) this.plannedExecutionFlags[ePos] = true;
    this.stats.decision_count++;
    const counter: Partial<
      Record<RebalanceReason, keyof ExecutionRebalanceStats>
    > = {
      calendar: 'calendar_count',
      drift: 'drift_count',
      tracking_error: 'tracking_error_count',
      signal: 'signal_count',
      circuit_breaker: 'circuit_breaker_count',
      post_cooldown: 'post_cooldown_count',
    };
    const key = counter[reason];
    if (key !== undefined) this.stats[key]++;
    this.finishObservation(target, positions, nav);

    const toRecord = (w: readonly number[]): Record<string, number> =>
      Object.fromEntries(this.instruments.map((s, j) => [s, w[j]!]));
    return {
      shouldRebalance: true,
      decisionTime,
      executionTime,
      reason,
      desiredWeights: toRecord(desired),
      persistentWeights: toRecord(persistent),
      proposedTurnover,
    };
  }

  private startBarObservation(
    barIndex: number,
    date: string,
    positions: Record<string, number>,
    nav: number,
  ): void {
    pushRing(this.ring, this.barExecutedTurnover);
    this.barExecutedTurnover = 0;
    const r =
      this.previousNav !== null && Math.abs(this.previousNav) > 1e-12
        ? nav / this.previousNav - 1
        : 0;
    this.portfolioReturns.push(r);
    this.returnDates.push(date);
    this.updateEntryBars(barIndex, positions);
    if (this.peakNav === null) this.peakNav = nav;
  }

  private finishObservation(
    target: number[],
    positions: Record<string, number>,
    nav: number,
  ): void {
    this.previousTarget = target.slice();
    this.previousPositions = this.vector(positions);
    this.previousNav = nav;
    if (this.peakNav === null || nav > this.peakNav) this.peakNav = nav;
  }

  private vector(values: Record<string, number>): number[] {
    return this.instruments.map((s) => finiteOr0(values[s] ?? 0));
  }

  private calendarDue(executionTime: string): boolean {
    const pos = this.datePos.get(executionTime);
    return pos !== undefined && this.calFlags[pos]!;
  }

  private signalChanged(target: number[]): boolean {
    if (!this.policy.rebalanceOnSignalChange || this.previousTarget === null)
      return false;
    return (
      Math.max(
        ...target.map((t, j) => Math.abs(t - this.previousTarget![j]!)),
      ) > this.policy.signalChangeThreshold
    );
  }

  private driftBreached(current: number[], target: number[]): boolean {
    const threshold = this.policy.driftThreshold;
    if (threshold === null) return false;
    return (
      Math.max(...perAssetDrift(current, target, this.policy.driftType)) >
      threshold
    );
  }

  private trackingErrorBreached(): boolean {
    const threshold = this.policy.trackingErrorThreshold;
    const window = Math.trunc(this.policy.trackingErrorWindow);
    if (
      threshold === null ||
      this.benchmark === null ||
      this.portfolioReturns.length < window ||
      window < 2
    ) {
      return false;
    }
    const port = this.portfolioReturns.slice(-window);
    const dates = this.returnDates.slice(-window);
    const active = port.map(
      (r, k) => r - (this.benchmark!.get(dates[k]!) ?? 0),
    );
    return stdDdof1(active) * Math.sqrt(this.periodsPerYear) > threshold;
  }

  private drawdownBreached(nav: number): boolean {
    const threshold = this.policy.maxDrawdownTrigger;
    if (threshold === null || this.peakNav === null || this.peakNav <= 0)
      return false;
    return nav / this.peakNav - 1 < threshold;
  }

  private applyPartialRebalance(
    current: number[],
    desired: number[],
    target: number[],
    barIndex: number,
  ): number[] {
    const threshold = this.policy.driftThreshold;
    if (!this.policy.partialRebalance || threshold === null || barIndex === 0)
      return desired;
    const keep = perAssetDrift(current, desired, this.policy.driftType).map(
      (d) => d <= threshold,
    );
    const output = desired.map((w, j) => (keep[j] ? current[j]! : w));
    this.stats.partial_positions_saved += keep.filter(Boolean).length;
    return renormalizeTradedSleeve(output, target, keep);
  }

  private applyTaxHeuristic(
    current: number[],
    desired: number[],
    target: number[],
    barIndex: number,
  ): number[] {
    if (!this.policy.avoidShortTermGains || barIndex === 0) return desired;
    const output = desired.slice();
    const keep = new Array<boolean>(output.length).fill(false);
    for (let j = 0; j < output.length; j++) {
      if (
        Math.abs(output[j]!) < Math.abs(current[j]!) - 1e-12 &&
        barIndex - this.entryBar[j]! < Math.trunc(this.policy.shortTermDays)
      ) {
        output[j] = current[j]!;
        keep[j] = true;
      }
    }
    return keep.some(Boolean)
      ? renormalizeTradedSleeve(output, target, keep)
      : output;
  }

  private updateEntryBars(
    barIndex: number,
    positions: Record<string, number>,
  ): void {
    this.vector(positions).forEach((nw, j) => {
      const old = this.previousPositions[j]!;
      const entered = Math.abs(old) <= 1e-12 && Math.abs(nw) > 1e-12;
      const reversed =
        Math.abs(old) > 1e-12 &&
        Math.abs(nw) > 1e-12 &&
        Math.sign(old) !== Math.sign(nw);
      const increased =
        Math.sign(old) === Math.sign(nw) &&
        Math.abs(nw) > Math.abs(old) + 1e-12;
      if (entered || reversed || increased) this.entryBar[j] = barIndex;
    });
  }

  private noDecision(input: EvaluateInput): ExecutionRebalanceDecision {
    return {
      shouldRebalance: false,
      decisionTime: input.decisionTime,
      executionTime: input.executionTime,
      reason: null,
      desiredWeights: { ...input.realizedWeights },
      persistentWeights: { ...input.realizedWeights },
      proposedTurnover: 0,
    };
  }
}
