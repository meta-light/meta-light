// Ported from backtester/portfolio/portf_calc.py and the metric assembly in
// backtester/engines/performance.py (QuantJourney Backtester, Apache 2.0).
//
// Result keys keep the Python snake_case names so the report config in
// formatters.ts can address them by the same dotted paths. Plots, HTML/JSON/CSV
// output are not ported.

import { type Frame, isNum, rolling } from '../../core/index';
import {
  cummax,
  cumprod,
  dayDiff,
  dropNaN,
  nanMax,
  nanMean,
  nanMin,
  nanProd,
  nanQuantile,
  nanStd,
  nanSum,
  periodStarts,
  resample,
  type ResampleRule,
  type Series,
  sortSeries,
  toMs,
} from './series';

export interface CalcConfig {
  /** Periods per year used for annualization. */
  daysPerYear: number;
  /** Annual risk-free rate as a decimal, e.g. 0.04. Null means 0. */
  riskFreeRateAnnual?: number | null;
}

export const DEFAULT_CALC_CONFIG: CalcConfig = {
  daysPerYear: 252,
  riskFreeRateAnnual: null,
};

export interface PortfolioSeries {
  /** Daily portfolio returns (may start with a display-only 0). */
  returns: Series;
  /** Observed returns for metrics, excluding that first 0. Defaults to `returns`. */
  returnsForMetrics?: Series;
  weights?: Frame | null;
  /** Overrides `daysPerYear` when no config is passed (e.g. intraday books). */
  periodsPerYear?: number;
}

export type MetricStatus = 'SUCCESS' | 'WARNING' | 'FAILED' | 'ERROR';

export type InsufficientData = { status: 'ERROR'; message: string; data: null };

export interface CumulativeReturns {
  status: 'SUCCESS';
  cumulative_returns: Series;
  total_return: number;
  annualized_return: number;
}

export interface PeriodicStatistics {
  MTD: number;
  QTD: number;
  YTD: number;
  '1Y': number;
  '3Y': number;
  '5Y': number;
  ITD: number;
  'ATH Value': number;
  'Drawdown from ATH (%)': number;
}

export interface PeriodicReturns {
  status: 'SUCCESS';
  periodic_returns: Series;
  statistics: PeriodicStatistics;
}

export interface PeriodStats {
  win_days: number;
  win_month: number;
  win_quarter: number;
  win_year: number;
}

export interface AdvancedVolatility {
  standard: number;
  current_30d: number;
  historical_252d: number;
  peak_95th: number;
  short_window: number;
  long_window: number;
  summary_stats: { min_vol: number; max_vol: number; avg_vol: number };
}

export interface AdvancedTurnover {
  total_turnover_ratio: number;
  total_turnover_pct: number;
  total_traded_notional: number;
  total_turnover: number;
  average_turnover: number;
  avg_daily_turnover_pct: number;
  annualized_turnover: number;
  annualized_turnover_pct: number;
  max_turnover: number;
  daily_turnover: number;
  turnover_std: number;
  source: 'weights_diff';
}

const insufficient = (message = 'Insufficient data'): InsufficientData => ({
  status: 'ERROR',
  message,
  data: null,
});

/** `compute_total_returns`: compounded return, NaN skipped. */
export const totalReturn = (returns: readonly number[]): number =>
  nanProd(returns.map((r) => 1 + r)) - 1;

/** `compute_annualized_returns`: annualized by row count over `daysPerYear`. */
export function annualizedReturnByCount(
  returns: readonly number[],
  daysPerYear = 252,
): number {
  if (!returns.length) return NaN;
  const years = Math.max(Math.max(returns.length, 1) / daysPerYear, 1e-9);
  return (1 + totalReturn(returns)) ** (1 / years) - 1;
}

/** `compute_drawdowns`: (nav - running peak) / running peak. */
export function drawdowns(returns: readonly number[]): number[] {
  const nav = cumprod(returns.map((r) => 1 + r));
  const peak = cummax(nav);
  return nav.map((v, i) => (v - peak[i]!) / peak[i]!);
}

/** `sharpe_ratio`: mean / std of excess returns, optionally annualized. */
export function sharpeRatio(
  returns: readonly number[],
  riskFreeRate = 0,
  daysPerYear = 252,
  annualize = true,
): number {
  const excess = returns.map((r) => r - riskFreeRate / daysPerYear);
  const ratio = nanMean(excess) / nanStd(excess);
  return annualize ? ratio * Math.sqrt(daysPerYear) : ratio;
}

export class PortfolioCalculations {
  readonly tradingDays: number;
  readonly riskFreeRate: number;

  constructor(
    private readonly data: PortfolioSeries,
    config?: CalcConfig,
  ) {
    let cfg = config ?? DEFAULT_CALC_CONFIG;
    if (!config && data.periodsPerYear !== undefined) {
      cfg = {
        ...cfg,
        daysPerYear: Math.max(Math.trunc(data.periodsPerYear), 1),
      };
    }
    this.tradingDays = Math.trunc(cfg.daysPerYear);
    this.riskFreeRate = cfg.riskFreeRateAnnual ?? 0;
  }

  get returns(): Series {
    return this.data.returns;
  }

  /** Observed returns used for metrics, with inf/NaN dropped. */
  get metricReturns(): Series {
    return dropNaN(this.data.returnsForMetrics ?? this.data.returns);
  }

  get weights(): Frame | null {
    return this.data.weights ?? null;
  }

  computeReturns(method: 'simple' | 'log' = 'simple'): Series {
    const r = this.metricReturns;
    return method === 'simple'
      ? r
      : { index: r.index, values: r.values.map(Math.log1p) };
  }

  computeCumulativeReturns(
    startingValue = 1.0,
  ): CumulativeReturns | InsufficientData {
    const r = this.returns;
    if (!r.values.length) return insufficient();
    const cum = cumprod(r.values.map((v) => 1 + v)).map(
      (v) => startingValue * v,
    );
    return {
      status: 'SUCCESS',
      cumulative_returns: { index: [...r.index], values: cum },
      total_return: cum[cum.length - 1]! - startingValue,
      annualized_return: annualizedReturnByCount(r.values, this.tradingDays),
    };
  }

  computePeriodicReturns(
    period: ResampleRule = 'ME',
    method: 'compound' | 'sum' = 'compound',
  ): PeriodicReturns | InsufficientData {
    if (!this.returns.values.length) return insufficient();
    const r = sortSeries(dropNaN(this.returns));
    if (!r.values.length) return insufficient();
    const periodic =
      method === 'compound'
        ? resample(r, period, (xs) => nanProd(xs.map((x) => 1 + x)) - 1)
        : resample(r, period, nanSum);

    const compound = (xs: readonly number[]): number =>
      xs.length ? nanProd(xs.map((x) => 1 + x)) - 1 : NaN;
    const since = (startMs: number): number =>
      compound(r.values.filter((_, i) => toMs(r.index[i]!) >= startMs));
    const trailing = (periods: number): number =>
      r.values.length < periods ? NaN : compound(r.values.slice(-periods));
    const annualizedTrailing = (periods: number): number => {
      const t = trailing(periods);
      return Number.isFinite(t)
        ? (1 + t) ** (this.tradingDays / periods) - 1
        : NaN;
    };

    const starts = periodStarts(r.index[r.index.length - 1]!);
    const nav = cumprod(r.values.map((x) => 1 + x));
    const ath = nanMax(nav);
    const ppy = Math.max(this.tradingDays, 1);

    return {
      status: 'SUCCESS',
      periodic_returns: periodic,
      statistics: {
        MTD: since(starts.month),
        QTD: since(starts.quarter),
        YTD: since(starts.year),
        '1Y': trailing(ppy),
        '3Y': annualizedTrailing(ppy * 3),
        '5Y': annualizedTrailing(ppy * 5),
        ITD: compound(r.values),
        'ATH Value': ath,
        'Drawdown from ATH (%)': ath > 0 ? nav[nav.length - 1]! / ath - 1 : NaN,
      },
    };
  }

  computeDrawdowns(): Series {
    return {
      index: [...this.returns.index],
      values: drawdowns(this.returns.values),
    };
  }

  computeMaxDrawdown(): number {
    return nanMin(drawdowns(this.returns.values));
  }

  computeSharpeRatio(riskFreeRate?: number, annualize = true): number {
    return sharpeRatio(
      this.metricReturns.values,
      riskFreeRate ?? this.riskFreeRate,
      this.tradingDays,
      annualize,
    );
  }

  computeSortinoRatio(
    riskFreeRate?: number,
    targetReturn = 0.0,
    annualize = true,
  ): number {
    const rf = riskFreeRate ?? this.riskFreeRate;
    const adjusted = this.metricReturns.values.map(
      (r) => r - (rf + targetReturn) / this.tradingDays,
    );
    const downside = adjusted.filter((v) => v < 0);
    if (!adjusted.length || !downside.length) return NaN;
    const downsideStd = Math.sqrt(
      nanSum(downside.map((v) => v * v)) / adjusted.length,
    );
    if (downsideStd === 0) return NaN;
    const ratio = nanMean(adjusted) / downsideStd;
    return annualize ? ratio * Math.sqrt(this.tradingDays) : ratio;
  }

  /** Gross weight churn: sum(|diff(weights)|) per date, 0 on the first row. */
  computeGrossWeightChange(): Series {
    const w = this.weights;
    if (!w || !w.length) return { index: [], values: [] };
    const values = w.index.map((_, i) => {
      if (i === 0) return 0;
      let total = 0;
      w.columns.forEach((_, j) => {
        const d = Math.abs(w.values[i]![j]! - w.values[i - 1]![j]!);
        if (isNum(d)) total += d;
      });
      return total;
    });
    return { index: [...w.index], values };
  }

  /** Half-turnover, so buys and sells are not double-counted. */
  computeTurnover(): Series {
    const g = this.computeGrossWeightChange();
    return { index: g.index, values: g.values.map((v) => v / 2) };
  }

  /** Rolling Sortino using only the negative returns in each window. */
  computeRollingSortino(
    window = 252,
    riskFreeRate = 0.0,
    targetReturn = 0.0,
  ): Series {
    const r = this.computeReturns();
    const x = r.values.map((v) => v - riskFreeRate / this.tradingDays);
    const td = this.tradingDays;
    const values = rolling(x, window, (win) => {
      const neg = win.filter((v) => v < targetReturn);
      const sd = nanStd(neg);
      if (neg.length < 2 || sd === 0) return NaN;
      return (nanMean(win) / sd) * Math.sqrt(td);
    });
    return { index: r.index, values };
  }

  /** Calendar-time CAGR: years = elapsed days / 365.25. */
  computeAnnualizedReturn(returns?: Series): number {
    const r = returns ?? this.returns;
    if (!r.values.length) return NaN;
    const years = dayDiff(r.index[0]!, r.index[r.index.length - 1]!) / 365.25;
    if (years <= 0) return NaN;
    return (1 + totalReturn(r.values)) ** (1 / years) - 1;
  }

  computePeriodStats(): PeriodStats {
    const r = this.returns;
    const winRate = (xs: readonly number[]): number =>
      xs.length ? (xs.filter((v) => v > 0).length / xs.length) * 100 : NaN;
    const compound = (xs: number[]): number =>
      nanProd(xs.map((x) => 1 + x)) - 1;
    return {
      win_days: winRate(r.values),
      win_month: winRate(resample(r, 'ME', compound).values),
      win_quarter: winRate(resample(r, 'QE', compound).values),
      win_year: winRate(resample(r, 'YE', compound).values),
    };
  }

  computeAdvancedAnnualizedVolatility(
    shortWindow?: number,
    longWindow?: number,
  ): AdvancedVolatility {
    const r = this.metricReturns.values;
    const annual = Math.sqrt(this.tradingDays);
    const short = Math.max(
      2,
      Math.trunc(
        shortWindow ||
          (this.tradingDays >= 252 ? 30 : Math.max(2, this.tradingDays)),
      ),
    );
    const long = Math.max(
      2,
      Math.trunc(longWindow || Math.max(2, this.tradingDays)),
    );
    const rollingShort = rolling(r, short, nanStd).map((v) => v * annual);
    const rollingLong = rolling(r, long, nanStd).map((v) => v * annual);
    const anyShort = rollingShort.some(isNum);
    const anyLong = rollingLong.some(isNum);
    return {
      standard: nanStd(r) * annual * 100,
      current_30d: anyShort
        ? rollingShort[rollingShort.length - 1]! * 100
        : NaN,
      historical_252d: anyLong
        ? rollingLong[rollingLong.length - 1]! * 100
        : NaN,
      peak_95th: anyLong ? nanQuantile(rollingLong, 0.95) * 100 : NaN,
      short_window: short,
      long_window: long,
      summary_stats: {
        min_vol: anyLong ? nanMin(rollingLong) * 100 : NaN,
        max_vol: anyLong ? nanMax(rollingLong) * 100 : NaN,
        avg_vol: anyLong ? nanMean(rollingLong) * 100 : NaN,
      },
    };
  }

  computeAdvancedCalmarRatio(): { base_calmar: number; status: 'success' } {
    const maxDd = Math.abs(this.computeMaxDrawdown());
    const calmar =
      maxDd !== 0 ? this.computeAnnualizedReturn() / maxDd : Infinity;
    return { base_calmar: calmar, status: 'success' };
  }

  computeRecoveryFactor(): number {
    const maxDd = Math.abs(this.computeMaxDrawdown());
    return maxDd === 0 ? Infinity : this.computeAnnualizedReturn() / maxDd;
  }

  computeAdvancedTurnover():
    AdvancedTurnover | { status: 'error'; message: string } {
    if (!this.weights) return { status: 'error', message: 'No weights data' };
    const turnover = this.computeTurnover().values;
    if (!turnover.length)
      return { status: 'error', message: 'No turnover data' };
    const avg = nanMean(turnover);
    const total = nanSum(turnover);
    return {
      total_turnover_ratio: total,
      total_turnover_pct: total * 100,
      total_traded_notional: NaN,
      total_turnover: total * 100,
      average_turnover: avg * 100,
      avg_daily_turnover_pct: avg * 100,
      annualized_turnover: avg * this.tradingDays * 100,
      annualized_turnover_pct: avg * this.tradingDays * 100,
      max_turnover: nanMax(turnover) * 100,
      daily_turnover: avg * 100,
      turnover_std: turnover.length > 1 ? nanStd(turnover) * 100 : 0,
      source: 'weights_diff',
    };
  }

  /**
   * The public metric set the Python report computes, keyed by the Python
   * method names. A metric that throws is recorded as null.
   */
  computeMetricResults(meta: MetricMeta = {}): MetricResults {
    const safe = <T>(fn: () => T): T | null => {
      try {
        return fn();
      } catch {
        return null;
      }
    };
    const rf = meta.riskFreeRate ?? this.riskFreeRate;
    return {
      compute_annualized_return: safe(() => this.computeAnnualizedReturn()),
      cumulative_returns: safe(() => this.computeCumulativeReturns()),
      compute_periodic_returns: safe(() => this.computePeriodicReturns()),
      compute_period_stats: safe(() => this.computePeriodStats()),
      compute_sharpe_ratio: safe(() => this.computeSharpeRatio()),
      compute_sortino_ratio: safe(() => this.computeSortinoRatio()),
      compute_max_drawdown: safe(() => this.computeMaxDrawdown()),
      compute_recovery_factor: safe(() => this.computeRecoveryFactor()),
      compute_advanced_calmar_ratio: safe(() =>
        this.computeAdvancedCalmarRatio(),
      ),
      compute_advanced_annualized_volatility: safe(() =>
        this.computeAdvancedAnnualizedVolatility(30, 252),
      ),
      compute_advanced_turnover: safe(() => this.computeAdvancedTurnover()),
      strategy_type: meta.strategyType ?? '',
      base_currency: meta.baseCurrency ?? 'USD',
      risk_free_rate: rf,
      returns_index: [...this.returns.index],
      config: { risk_free_rate: rf, reporting_frequency: 'daily' },
      ...(meta.executionContext
        ? { execution_context: meta.executionContext }
        : {}),
    };
  }
}

export interface MetricMeta {
  strategyType?: string;
  baseCurrency?: string;
  riskFreeRate?: number;
  executionContext?: {
    backtester_version?: string;
    data_start?: string;
    data_end?: string;
    initial_capital?: number;
  };
}

export interface MetricResults {
  compute_annualized_return: number | null;
  cumulative_returns: CumulativeReturns | InsufficientData | null;
  compute_periodic_returns: PeriodicReturns | InsufficientData | null;
  compute_period_stats: PeriodStats | null;
  compute_sharpe_ratio: number | null;
  compute_sortino_ratio: number | null;
  compute_max_drawdown: number | null;
  compute_recovery_factor: number | null;
  compute_advanced_calmar_ratio: {
    base_calmar: number;
    status: 'success';
  } | null;
  compute_advanced_annualized_volatility: AdvancedVolatility | null;
  compute_advanced_turnover:
    AdvancedTurnover | { status: 'error'; message: string } | null;
  strategy_type: string;
  base_currency: string;
  risk_free_rate: number;
  returns_index: string[];
  config: { risk_free_rate: number; reporting_frequency: 'daily' };
  execution_context?: MetricMeta['executionContext'];
}
