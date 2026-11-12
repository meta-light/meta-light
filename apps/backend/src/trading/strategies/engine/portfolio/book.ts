// Ported from backtester/portfolio/book.py (QuantJourney Backtester, Apache 2.0)
//
// Portfolio-of-strategies accounting. StrategyBook treats each strategy NAV as
// a tradeable sleeve: a capital allocator, not a security-level merger, so it
// never nets offsetting underlying positions across strategies.
//
// Allocation timestamps are point-in-time. Dynamic allocations are
// forward-filled onto sleeve timestamps and never backfilled. The rebalance
// engine applies a target at the close of its timestamp, so it can affect
// returns only from the following period.

import { Frame } from '../../../../services/trading/strategies/core';
import { dateMs, isClose, type SeriesLike } from './frame-utils';
import {
  type PortfolioRebalancePolicy,
  RebalanceEngine,
  type RebalanceStats,
} from './rebalance';
import {
  FixedBpsWeightCostModel,
  solveRecursiveWeightCosts,
  type WeightCostBreakdown,
  type WeightCostModel,
} from './weight-cost';

export type SleeveSeriesKind = 'nav' | 'returns';

/** A sleeve is a bare series (kind from seriesKind) or an object exposing a NAV series. */
export type SleeveSource = SeriesLike | { netAssetValue: SeriesLike };

export interface StrategyBookOptions {
  /** Defaults to a daily policy. Close-of-period timing is preserved. */
  rebalancePolicy?: PortfolioRebalancePolicy;
  /** Cost on implied sleeve-unit trades. Defaults to zero cost. */
  weightCostModel?: WeightCostModel;
  initialCapital?: number;
  /** "nav" or "returns" for every bare series, or a mapping by sleeve. */
  seriesKind?: SleeveSeriesKind | Readonly<Record<string, SleeveSeriesKind>>;
  periodsPerYear?: number;
}

export interface StrategyBookStats extends Partial<RebalanceStats> {
  sleeve_count: number;
  period_count: number;
  start: string;
  end: string;
  initial_capital: number;
  final_nav: number;
  total_return: number;
  total_turnover: number;
  total_costs: number;
  total_cost_pct_initial_capital: number;
  average_gross_allocation: number;
  underlying_security_netting: false;
}

/**
 * Auditable output of one StrategyBook run. `returns` includes cost drag,
 * including any initial allocation cost on its first row.
 */
export interface StrategyBookResult {
  nav: number[];
  returns: number[];
  targetAllocations: Frame;
  /** End-of-period sleeve allocations. */
  actualAllocations: Frame;
  sleeveUnits: Frame;
  sleeveValues: Frame;
  cash: number[];
  rebalanceFlags: boolean[];
  turnover: number[];
  /** Book transaction cost per period (alias: transactionCosts). */
  costs: number[];
  sleeveNav: Frame;
  grossReturns: number[];
  costBreakdown: WeightCostBreakdown;
  stats: StrategyBookStats;
}

const isSeries = (x: unknown): x is SeriesLike =>
  typeof x === 'object' &&
  x !== null &&
  Array.isArray((x as SeriesLike).index) &&
  Array.isArray((x as SeriesLike).values);

/** Allocate capital across independently simulated strategy sleeves. */
export class StrategyBook {
  private readonly names: string[];
  private readonly sleeves: Readonly<Record<string, SleeveSource>>;
  private readonly allocations: Readonly<Record<string, number>> | Frame;
  private readonly policy: PortfolioRebalancePolicy;
  private readonly costModel: WeightCostModel;
  private readonly initialCapital: number;
  private readonly seriesKind:
    SleeveSeriesKind | Record<string, SleeveSeriesKind>;
  private readonly periodsPerYear: number;

  /**
   * @param sleeves stable sleeve name to series or NAV-bearing object
   * @param allocations static weights, or a point-in-time Frame (columns may be sparse, each forward-filled)
   */
  constructor(
    sleeves: Readonly<Record<string, SleeveSource>>,
    allocations: Readonly<Record<string, number>> | Frame,
    options: StrategyBookOptions = {},
  ) {
    const names = Object.keys(sleeves);
    if (names.length === 0)
      throw new Error('sleeves must be a non-empty mapping');
    if (names.some((n) => !n.trim()))
      throw new Error('every sleeve name must be a non-empty string');

    const capital = options.initialCapital ?? 1_000_000;
    if (!Number.isFinite(capital) || capital <= 0)
      throw new Error('initial_capital must be finite and positive');
    const ppy = options.periodsPerYear ?? 252;
    if (!Number.isInteger(ppy) || ppy <= 0)
      throw new Error('periods_per_year must be a positive integer');

    this.names = names;
    this.sleeves = { ...sleeves };
    this.allocations =
      allocations instanceof Frame ? allocations : { ...allocations };
    this.policy = options.rebalancePolicy ?? {};
    this.costModel = options.weightCostModel ?? new FixedBpsWeightCostModel(0);
    this.initialCapital = capital;
    this.seriesKind = this.validateSeriesKind(options.seriesKind ?? 'nav');
    this.periodsPerYear = ppy;
  }

  /** Run the book and return aligned allocation and accounting output. */
  run(): StrategyBookResult {
    const sleeveNav = this.prepareSleeveNav();
    const index = sleeveNav.index;
    const targetAllocations = this.prepareAllocations(index);
    const sleeveReturns = sleeveNav.pctChange().fillNaN(0);

    const engine = new RebalanceEngine(this.policy, {
      periodsPerYear: this.periodsPerYear,
    });
    const rebalance = engine.run(targetAllocations, sleeveReturns);
    const actualAllocations = rebalance.actualWeights;
    const rebalanceFlags = rebalance.rebalanceFlags;
    const grossReturns = rebalance.portfolioReturns.slice();

    const { nav, netReturns, breakdown } = solveRecursiveWeightCosts({
      actualWeights: actualAllocations,
      prices: sleeveNav,
      grossReturns,
      initialCapital: this.initialCapital,
      rebalanceFlags,
      costModel: this.costModel,
    });
    const costs = breakdown.totalCost.slice();

    const sleeveValues = actualAllocations.mulRows(nav);
    const sleeveUnits = sleeveValues.zip(sleeveNav, (v, p) => v / p);
    const valueSum = sleeveValues.rowSum();
    const cash = nav.map((v, i) => v - valueSum[i]!);
    const reconciled = cash.map((c, i) => c + valueSum[i]!);
    if (!nav.every((v, i) => isClose(v, reconciled[i]!, 1e-10, 1e-8))) {
      throw new Error('StrategyBook accounting identity failed');
    }

    const tradeSum = breakdown.tradeValues.rowSum();
    const turnover = nav.map((v, i) => {
      if (v === 0) return 0;
      const t = tradeSum[i]! / v;
      return Number.isFinite(t) ? t : 0;
    });

    const total = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0);
    const grossAlloc = actualAllocations.values.map((row) =>
      row.reduce((s, v) => (Number.isNaN(v) ? s : s + Math.abs(v)), 0),
    );
    const finalNav = nav[nav.length - 1]!;
    const totalCosts = total(costs);
    const stats: StrategyBookStats = {
      ...(rebalance.stats as Partial<RebalanceStats>),
      sleeve_count: this.names.length,
      period_count: nav.length,
      start: index[0]!,
      end: index[index.length - 1]!,
      initial_capital: this.initialCapital,
      final_nav: finalNav,
      total_return: finalNav / this.initialCapital - 1,
      total_turnover: total(turnover),
      total_costs: totalCosts,
      total_cost_pct_initial_capital: totalCosts / this.initialCapital,
      average_gross_allocation: total(grossAlloc) / grossAlloc.length,
      underlying_security_netting: false,
    };

    return {
      nav,
      returns: netReturns,
      targetAllocations,
      actualAllocations,
      sleeveUnits,
      sleeveValues,
      cash,
      rebalanceFlags,
      turnover,
      costs,
      sleeveNav,
      grossReturns,
      costBreakdown: breakdown,
      stats,
    };
  }

  private validateSeriesKind(
    kind: SleeveSeriesKind | Readonly<Record<string, SleeveSeriesKind>>,
  ): SleeveSeriesKind | Record<string, SleeveSeriesKind> {
    const check = (raw: string, label: string): SleeveSeriesKind => {
      const k = raw.toLowerCase().trim();
      if (k !== 'nav' && k !== 'returns')
        throw new Error(`${label} must be 'nav' or 'returns'`);
      return k;
    };
    if (typeof kind === 'string') return check(kind, 'series_kind');
    const keys = Object.keys(kind);
    const unknown = keys.filter((k) => !this.names.includes(k)).sort();
    const missing = this.names.filter((n) => !keys.includes(n)).sort();
    if (unknown.length || missing.length) {
      throw new Error(
        'series_kind mapping must contain exactly the sleeve names; ' +
          `missing=${JSON.stringify(missing)}, unknown=${JSON.stringify(unknown)}`,
      );
    }
    const out: Record<string, SleeveSeriesKind> = {};
    for (const name of keys)
      out[name] = check(kind[name]!, `series_kind[${name}]`);
    return out;
  }

  private kindFor(name: string): SleeveSeriesKind {
    return typeof this.seriesKind === 'string'
      ? this.seriesKind
      : this.seriesKind[name]!;
  }

  /** Validate an index and return its UTC milliseconds. */
  private static utcIndex(index: readonly string[], label: string): number[] {
    const ms = index.map(dateMs);
    for (let i = 1; i < ms.length; i++) {
      if (ms[i] === ms[i - 1])
        throw new Error(`${label} index must not contain duplicate timestamps`);
      if (ms[i]! < ms[i - 1]!)
        throw new Error(`${label} index must be strictly increasing`);
    }
    return ms;
  }

  private coerceSleeve(
    name: string,
    source: SleeveSource,
  ): { ms: number[]; labels: readonly string[]; nav: number[] } {
    let raw: SeriesLike;
    let kind: SleeveSeriesKind;
    if (isSeries(source)) {
      raw = source;
      kind = this.kindFor(name);
    } else if (
      isSeries((source as { netAssetValue?: unknown }).netAssetValue)
    ) {
      raw = source.netAssetValue;
      kind = 'nav';
    } else {
      throw new Error(
        `sleeve ${name} must be a Series or expose a Series attribute net_asset_value`,
      );
    }
    if (raw.index.length === 0) throw new Error(`sleeve ${name} is empty`);
    const ms = StrategyBook.utcIndex(raw.index, `sleeve ${name}`);
    const values = raw.values.slice(0, raw.index.length);
    if (
      values.length !== raw.index.length ||
      values.some((v) => !Number.isFinite(v))
    ) {
      throw new Error(`sleeve ${name} contains missing or non-finite values`);
    }
    let nav: number[];
    if (kind === 'returns') {
      if (values.some((v) => v <= -1))
        throw new Error(`sleeve ${name} contains a return <= -100%`);
      let acc = 1;
      const cum = values.map((r) => (acc *= 1 + r));
      nav = cum.map((v) => v / cum[0]!);
    } else {
      if (values.some((v) => v <= 0))
        throw new Error(`sleeve ${name} NAV must stay positive`);
      nav = values;
    }
    return { ms, labels: raw.index, nav };
  }

  /** Union of sleeve timestamps over the common lifetime, forward-filled. */
  private prepareSleeveNav(): Frame {
    const series = this.names.map((name) =>
      this.coerceSleeve(name, this.sleeves[name]!),
    );
    const start = Math.max(...series.map((s) => s.ms[0]!));
    const end = Math.min(...series.map((s) => s.ms[s.ms.length - 1]!));
    if (start > end)
      throw new Error('sleeves have no overlapping observable lifetime');

    const labelByMs = new Map<number, string>();
    for (const s of series) {
      s.ms.forEach((t, i) => {
        if (t >= start && t <= end && !labelByMs.has(t))
          labelByMs.set(t, s.labels[i]!);
      });
    }
    const times = [...labelByMs.keys()].sort((a, b) => a - b);
    if (times.length === 0)
      throw new Error('sleeves have no common valuation timestamps');

    // reindex(index).ffill(): carry the last observation at or before each time.
    const columns = series.map((s) => {
      let k = -1;
      return times.map((t) => {
        while (k + 1 < s.ms.length && s.ms[k + 1]! <= t) k++;
        return k >= 0 ? s.nav[k]! : NaN;
      });
    });
    const values = times.map((_, i) => columns.map((c) => c[i]!));
    if (values.some((row) => row.some(Number.isNaN))) {
      throw new Error('sleeve alignment would require look-ahead backfilling');
    }
    return new Frame(
      times.map((t) => labelByMs.get(t)!),
      this.names,
      values,
    );
  }

  private prepareAllocations(index: readonly string[]): Frame {
    const indexMs = index.map(dateMs);
    if (this.allocations instanceof Frame) {
      const raw = this.allocations;
      if (new Set(raw.columns).size !== raw.columns.length)
        throw new Error('allocation columns must be unique');
      const unknown = raw.columns.filter((c) => !this.names.includes(c)).sort();
      if (unknown.length)
        throw new Error(
          `allocations contain unknown sleeves: ${JSON.stringify(unknown)}`,
        );
      const rawMs = StrategyBook.utcIndex(raw.index, 'allocations');
      if (
        raw.values.some((row) =>
          row.some((v) => v === Infinity || v === -Infinity),
        )
      ) {
        throw new Error('allocations contain infinite values');
      }
      // Missing sleeves are 0; each column is forward-filled independently up
      // to each book timestamp and never backfilled.
      const columns = this.names.map((name) => {
        const j = raw.columns.indexOf(name);
        let k = -1;
        let last = j < 0 ? 0 : NaN;
        return indexMs.map((t) => {
          while (k + 1 < rawMs.length && rawMs[k + 1]! <= t) {
            k++;
            if (j >= 0 && !Number.isNaN(raw.values[k]![j]!))
              last = raw.values[k]![j]!;
          }
          return last;
        });
      });
      const values = index.map((_, i) => columns.map((c) => c[i]!));
      if (values.some((row) => row.some(Number.isNaN))) {
        const missing = this.names.filter((_, j) =>
          Number.isNaN(values[0]![j]!),
        );
        throw new Error(
          'dynamic allocations require an initial point-in-time value ' +
            `on or before the first book timestamp; missing=${JSON.stringify(missing)}`,
        );
      }
      return new Frame(index, this.names, values);
    }

    const alloc = this.allocations;
    const keys = Object.keys(alloc);
    if (keys.length === 0)
      throw new Error('allocations must be a non-empty mapping or DataFrame');
    const unknown = keys.filter((k) => !this.names.includes(k)).sort();
    if (unknown.length)
      throw new Error(
        `allocations contain unknown sleeves: ${JSON.stringify(unknown)}`,
      );
    const row = this.names.map((name) => {
      const v = alloc[name] ?? 0;
      if (!Number.isFinite(v))
        throw new Error(`allocation for ${name} must be finite`);
      return v;
    });
    return new Frame(
      index,
      this.names,
      index.map(() => row.slice()),
    );
  }
}
