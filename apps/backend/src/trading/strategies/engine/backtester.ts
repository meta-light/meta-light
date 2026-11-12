// Ported from backtester/core.py (QuantJourney Backtester, Apache 2.0)
//
// The backtest run loop. Weights mode: signals, weights, risk overlay, a
// one-bar lag, then the rebalance engine and the recursive weight ledger
// ("fast"), or target-weight orders through the fill engine ("orders").
// Orders mode: the strategy submits orders bar by bar through the execution
// simulator. Every path ends in PortfolioCalculations metrics.
//
// Skipped from core.py: the data SDK client, the reporting mixin, plots and
// the CLI. Data comes in as a BarData; reporting stays with the caller.

import {
  type Bar,
  type Broker,
  type FillEngine as CoreFillEngine,
  Frame,
  OrdersStrategy,
  type Strategy,
  WeightsStrategy,
} from '../../../services/trading/strategies/core';
import type { BarData } from './data';
import {
  type CommissionModel,
  ExecutionSimulator,
  type ExecOrder,
  type Fill,
  FillEngine,
  type FillAt,
  type FullContractSpec,
  type LedgerLike,
  type PreTradeCheck,
  type PreTradeContext,
  type Slippage,
  TargetWeightOrderExecutor,
  commissionFromConfig,
  getContractSpec,
  slippageFromConfig,
} from '../../../services/trading/strategies/engine/execution';
import {
  Blotter,
  type BenchmarkSummary,
  type MetricResults,
  PortfolioCalculations,
  type Series,
  computeBenchmarkSummary,
  dropNaN,
} from '../../../services/trading/strategies/engine/metrics';
import {
  ExecutionRebalanceEngine,
  FixedBpsWeightCostModel,
  type LedgerResult,
  PortfolioLedger,
  type PortfolioRebalancePolicy,
  type PortfolioSnapshot,
  RebalanceEngine,
  type SeriesLike,
  type WeightCostModel,
  buildWeightLedger,
} from '../../../services/trading/strategies/engine/portfolio';
import { ffillFrame, reindexFrame } from './portfolio/frame-utils';
import {
  type PortfolioSnapshot as RiskSnapshot,
  type PreTradeOrder,
  PreTradeRisk,
  type RiskModel,
  defaultRiskModel,
  returnsPreserveGaps,
} from '../../../services/trading/strategies/engine/risk';

export type WeightExecution = 'fast' | 'orders';

export interface BacktesterOptions {
  /** Fraction of NAV held back from target weights (default 0.05). */
  cashBuffer?: number;
  /** "fast" = rebalance engine + weight ledger, "orders" = target-weight orders. */
  weightExecution?: WeightExecution;
  /** Weight-mode cost model (default 1 bps fixed). */
  weightCostModel?: WeightCostModel;
  /** Fill timing; defaults to the policy's rebalanceAt in weight-orders mode, else "open". */
  fillAt?: FillAt;
  maxVolumeParticipation?: number;
  volumeLookback?: number;
  expectedOpenVolumeFraction?: number;
  /** Defaults to the strategy config's slippage. */
  slippage?: Slippage;
  /** Defaults to the strategy config's commission. */
  commission?: CommissionModel;
  preTradeRisk?: PreTradeRisk;
  /** Overlay applied to weights. Undefined uses defaultRiskModel(config); null disables. */
  riskModel?: RiskModel | null;
  /** Defaults to config.rebalancePolicy. */
  rebalancePolicy?: PortfolioRebalancePolicy;
  /** Benchmark returns for the tracking-error trigger and the summary. */
  benchmarkReturns?: SeriesLike;
  periodsPerYear?: number;
  baseCurrency?: string;
  riskFreeRate?: number;
}

export type BacktestMode = 'weights_fast' | 'weights_orders' | 'orders';

export interface BacktestResult {
  mode: BacktestMode;
  dates: string[];
  nav: number[];
  returns: number[];
  /** Orders paths only: nav.pctChange() without the leading NaN. */
  returnsForMetrics?: Series;
  /** Exposure weights per date. */
  weights: Frame;
  positions: Frame;
  /** Total transaction cost per date. */
  transactionCosts: number[];
  rebalanceFlags: boolean[];
  stats: Record<string, unknown>;
  ledger: LedgerResult;
  fills: Fill[];
  blotter: Blotter;
  metrics: MetricResults;
  benchmark: BenchmarkSummary | null;
  warnings: string[];
  signals: Frame | null;
  /** Risk-adjusted strategy weights before the lag and cash buffer. */
  targetWeights: Frame | null;
}

type SpecResolver = (instrument: string) => FullContractSpec;

/** One cached spec per symbol, settlement currency checked on every call (as core.py does). */
function makeSpecResolver(baseCurrency: string): SpecResolver {
  const cache = new Map<string, FullContractSpec>();
  return (instrument) => {
    const key = instrument.toUpperCase();
    let spec = cache.get(key);
    if (!spec) {
      spec = getContractSpec(key);
      cache.set(key, spec);
    }
    spec.validateSettlementCurrency(baseCurrency);
    return spec;
  };
}

/** PortfolioLedger behind the simulator's LedgerLike shape. */
class LedgerAdapter implements LedgerLike<PortfolioSnapshot, LedgerResult> {
  constructor(
    readonly inner: PortfolioLedger,
    private readonly spec: SpecResolver,
  ) {}
  get initialCash(): number {
    return this.inner.initialCash;
  }
  get instruments(): readonly string[] {
    return this.inner.instruments;
  }
  // PortfolioLedger reassigns these on reset, so always read through.
  get positions(): Readonly<Record<string, number>> {
    return this.inner.positions;
  }
  get averageEntryPrice(): Readonly<Record<string, number | null>> {
    return this.inner.averageEntryPrice;
  }
  reset(): void {
    this.inner.reset();
  }
  prepareHistory(dates: readonly string[]): void {
    this.inner.prepareHistory(dates);
  }
  observeMark(instrument: string, price: number): void {
    this.inner.observeMark(instrument, price);
  }
  isValidPrice(value: number, instrument: string): boolean {
    return this.inner.isValidPrice(value, instrument);
  }
  applyFill(fill: Fill): { tradeNotional: number } {
    const { instrument, side, quantity, fillPrice, commission } = fill;
    return this.inner.applyFill({
      instrument,
      side,
      quantity,
      fillPrice,
      commission,
    });
  }
  markToMarket(
    prices: Readonly<Record<string, number>>,
  ): [number, Record<string, number>] {
    const r = this.inner.markToMarket(prices);
    return [r.nav, r.positionValues];
  }
  snapshot(args: {
    prices: Readonly<Record<string, number>>;
    nav: number;
  }): PortfolioSnapshot {
    return this.inner.snapshot(args);
  }
  record(args: {
    date: string;
    nav: number;
    positionValues: Record<string, number>;
    prices: Readonly<Record<string, number>>;
  }): void {
    this.inner.record(args);
  }
  contractSpec(instrument: string): FullContractSpec {
    return this.spec(instrument);
  }
  exposureWeights(args: {
    prices: Readonly<Record<string, number>>;
    nav: number;
  }): Record<string, number> {
    return this.inner.exposureWeights(args);
  }
  result(): LedgerResult {
    return this.inner.result();
  }
}

/** PreTradeRisk behind the simulator's PreTradeCheck shape. */
class PreTradeAdapter implements PreTradeCheck<PortfolioSnapshot> {
  constructor(
    private readonly risk: PreTradeRisk,
    private readonly spec: SpecResolver,
  ) {}
  evaluate(order: ExecOrder, ctx: PreTradeContext<PortfolioSnapshot>) {
    return this.risk.evaluate(
      order as unknown as PreTradeOrder,
      ctx.portfolio as unknown as RiskSnapshot,
      this.spec,
      ctx.pendingOrders as unknown as PreTradeOrder[],
    );
  }
  evaluateBatch(
    orders: readonly ExecOrder[],
    ctx: PreTradeContext<PortfolioSnapshot> & {
      allowCrossInstrumentNetting: boolean;
    },
  ) {
    return this.risk.evaluateBatch(
      orders as unknown as PreTradeOrder[],
      ctx.portfolio as unknown as RiskSnapshot,
      this.spec,
      ctx.pendingOrders as unknown as PreTradeOrder[],
      ctx.allowCrossInstrumentNetting,
    );
  }
}

interface PathResult {
  nav: number[];
  returns: number[];
  returnsForMetrics?: Series;
  weights: Frame;
  positions: Frame;
  transactionCosts: number[];
  rebalanceFlags: boolean[];
  stats: Record<string, unknown>;
  ledger: LedgerResult;
  fills: Fill[];
}

export class Backtester {
  readonly instruments: string[];
  readonly dates: string[];
  readonly periodsPerYear: number;
  readonly baseCurrency: string;
  readonly cashBuffer: number;
  readonly weightExecution: WeightExecution;
  readonly rebalancePolicy: PortfolioRebalancePolicy;
  readonly riskModel: RiskModel | null;
  readonly blotter = new Blotter();
  readonly warnings: string[] = [];
  private readonly spec: SpecResolver;

  constructor(
    readonly strategy: Strategy,
    readonly data: BarData,
    readonly options: BacktesterOptions = {},
  ) {
    const cfg = strategy.config;
    this.instruments = cfg.instruments.slice();
    this.dates = data.dates.slice();
    this.periodsPerYear = Math.max(
      Math.trunc(options.periodsPerYear ?? 252),
      1,
    );
    this.baseCurrency = (options.baseCurrency ?? 'USD').toUpperCase();
    this.cashBuffer = options.cashBuffer ?? 0.05;
    this.weightExecution = options.weightExecution ?? 'fast';
    this.rebalancePolicy =
      options.rebalancePolicy ??
      (cfg.rebalancePolicy as PortfolioRebalancePolicy | undefined) ??
      {};
    this.riskModel =
      options.riskModel === undefined
        ? defaultRiskModel(cfg)
        : options.riskModel;
    this.spec = makeSpecResolver(this.baseCurrency);
    // Validate the universe up front, like the Python constructor.
    for (const inst of this.instruments) this.spec(inst);
    strategy.data = data;
  }

  get initialCapital(): number {
    return this.strategy.config.initialCapital;
  }

  run(): BacktestResult {
    this.blotter.reset();
    this.warnings.length = 0;
    const strategy = this.strategy;
    let signals: Frame | null = null;
    let targetWeights: Frame | null = null;
    let mode: BacktestMode;
    let path: PathResult;

    if (strategy instanceof OrdersStrategy) {
      mode = 'orders';
      path = this.runOrders(strategy);
    } else if (strategy instanceof WeightsStrategy) {
      signals = this.validate(strategy.computeSignals(), 'signals');
      strategy.signals = signals;
      let weights = this.validate(strategy.computeWeights(), 'weights');
      if (this.riskModel) {
        const returns = returnsPreserveGaps(this.feature('adj_close'));
        weights = this.validate(
          this.riskModel.adjust(weights, returns, {
            periodsPerYear: this.periodsPerYear,
          }),
          'weights',
        );
      }
      targetWeights = weights;
      if (this.weightExecution === 'orders') {
        mode = 'weights_orders';
        path = this.runWeightOrders(weights);
      } else {
        mode = 'weights_fast';
        path = this.runWeightsFast(weights);
      }
    } else {
      throw new Error('strategy must extend WeightsStrategy or OrdersStrategy');
    }

    const returnsSeries: Series = {
      index: this.dates.slice(),
      values: path.returns.slice(),
    };
    const metrics = new PortfolioCalculations({
      returns: returnsSeries,
      returnsForMetrics: path.returnsForMetrics,
      weights: path.weights,
      periodsPerYear: this.periodsPerYear,
    }).computeMetricResults({
      strategyType: this.strategy.config.strategyType,
      baseCurrency: this.baseCurrency,
      riskFreeRate: this.options.riskFreeRate,
      executionContext: {
        data_start: this.dates[0],
        data_end: this.dates[this.dates.length - 1],
        initial_capital: this.initialCapital,
      },
    });
    const bench = this.options.benchmarkReturns;
    const benchmark = bench
      ? computeBenchmarkSummary(
          { index: [...bench.index], values: [...bench.values] },
          this.periodsPerYear,
        )
      : null;

    return {
      mode,
      dates: this.dates.slice(),
      ...path,
      blotter: this.blotter,
      metrics,
      benchmark,
      warnings: this.warnings.slice(),
      signals,
      targetWeights,
    };
  }

  // --- helpers --------------------------------------------------------------

  private feature(name: string): Frame {
    return reindexFrame(
      this.data.getFeature(name),
      this.dates,
      this.instruments,
    );
  }

  /** core.py _validate_strategy_output: exact dates, exact universe (reordered), finite values. */
  private validate(frame: Frame, name: string): Frame {
    const label = name[0]!.toUpperCase() + name.slice(1);
    if (!frame.index.length || !frame.columns.length)
      throw new Error(`${label} must not be empty`);
    if (new Set(frame.index).size !== frame.index.length)
      throw new Error(`${label} index contains duplicate timestamps`);
    if (new Set(frame.columns).size !== frame.columns.length)
      throw new Error(`${label} columns contain duplicate instruments`);
    const sameIndex =
      frame.index.length === this.dates.length &&
      frame.index.every((d, i) => d === this.dates[i]);
    if (!sameIndex) {
      throw new Error(
        `${label} index must exactly match the market-data index (${this.dates.length} rows expected, got ${frame.index.length})`,
      );
    }
    const missing = this.instruments.filter((c) => !frame.columns.includes(c));
    const unexpected = frame.columns.filter(
      (c) => !this.instruments.includes(c),
    );
    if (missing.length || unexpected.length) {
      throw new Error(
        `${label} columns must exactly match the strategy universe; missing=${JSON.stringify(missing)}, unexpected=${JSON.stringify(unexpected)}`,
      );
    }
    const out = reindexFrame(frame, this.dates, this.instruments);
    if (!out.values.every((row) => row.every(Number.isFinite)))
      throw new Error(`${label} must contain only finite numeric values`);
    return out;
  }

  /** core.py _compute_accounting_returns: gap bars stay NaN, resume bar carries the bridged move. */
  private static accountingReturns(prices: Frame): Frame {
    const filled = ffillFrame(prices).pctChange();
    return filled.map((v, r, c) => {
      const p = prices.values[r]![c]!;
      if (Number.isNaN(p)) return NaN;
      return r === 0 ? 0 : v;
    });
  }

  private makeFillEngine(fillAt: FillAt): FillEngine {
    const o = this.options;
    const cfg = this.strategy.config;
    return new FillEngine({
      slippage:
        o.slippage ??
        slippageFromConfig(
          cfg.slippage as Parameters<typeof slippageFromConfig>[0],
        ),
      commission:
        o.commission ??
        commissionFromConfig(
          cfg.commission as Parameters<typeof commissionFromConfig>[0],
        ),
      fillAt,
      maxVolumeParticipation: o.maxVolumeParticipation,
      volumeLookback: o.volumeLookback,
      expectedOpenVolumeFraction: o.expectedOpenVolumeFraction,
      notionalFn: (instrument, price, quantity) =>
        this.spec(instrument).notional(quantity, price),
    });
  }

  private makeSimulator(fillEngine: FillEngine, preTradeRisk: PreTradeRisk) {
    const ledger = new LedgerAdapter(
      new PortfolioLedger({
        initialCash: this.initialCapital,
        instruments: this.instruments,
        contractSpecResolver: this.spec,
        settlementCurrency: this.baseCurrency,
      }),
      this.spec,
    );
    const simulator = new ExecutionSimulator<PortfolioSnapshot, LedgerResult>({
      fillEngine,
      ledger,
      preTradeRisk: new PreTradeAdapter(preTradeRisk, this.spec),
    });
    return { ledger, simulator };
  }

  private simulatorFrames() {
    const close = this.feature('close');
    const pick = (name: string): Frame => {
      const f = this.feature(name);
      // Missing open/high/low fall back to close, like core.py.
      return f.map((v, r, c) => (Number.isNaN(v) ? close.values[r]![c]! : v));
    };
    return {
      close,
      open: pick('open'),
      high: pick('high'),
      low: pick('low'),
      volume: this.feature('volume'),
    };
  }

  /** Commission plus |slippage PnL| per fill, summed by date (core.py total_transaction_costs). */
  private costsFromFills(fills: readonly Fill[]): number[] {
    const pos = new Map(this.dates.map((d, i) => [d, i]));
    const out = new Array<number>(this.dates.length).fill(0);
    for (const f of fills) {
      const i = pos.get(f.timestamp);
      if (i === undefined) continue;
      let cost = f.commission;
      if (f.theoreticalPrice != null)
        cost += Math.abs(
          this.spec(f.instrument).pnl(
            f.quantity,
            f.theoreticalPrice,
            f.fillPrice,
          ),
        );
      out[i]! += cost;
    }
    return out;
  }

  private recordFill(fill: Fill, tradeNotional: number): void {
    this.blotter.recordTrade({
      orderId: fill.orderId,
      instrument: fill.instrument,
      side: fill.side,
      quantity: fill.quantity,
      price: fill.fillPrice,
      tradeValue: tradeNotional,
      timestamp: fill.timestamp,
      transactionCost: fill.commission,
      slippage: fill.slippage,
      theoreticalPrice: fill.theoreticalPrice,
      fillStatus: fill.orderStatus,
    });
  }

  private ordersPathResult(
    result: LedgerResult,
    fillEngine: FillEngine,
    extra: Pick<PathResult, 'rebalanceFlags' | 'stats'>,
  ): PathResult {
    const nav = result.nav;
    const navReturns: Series = {
      index: this.dates.slice(),
      values: nav.map((v, i) => (i === 0 ? NaN : v / nav[i - 1]! - 1)),
    };
    const fills = fillEngine.fillHistory.slice();
    this.blotter.recordEngineOrders(fillEngine.orderHistory);
    return {
      nav,
      returns: result.returns,
      returnsForMetrics: dropNaN(navReturns),
      weights: result.exposureWeights,
      positions: result.positions,
      transactionCosts: this.costsFromFills(fills),
      ledger: result,
      fills,
      ...extra,
    };
  }

  // --- paths ------------------------------------------------------------------

  /** core.py _run_weight_based_simulation. */
  private runWeightsFast(weights: Frame): PathResult {
    const close = this.feature('adj_close');
    const target = weights
      .shift(1)
      .fillNaN(0)
      .map((v) => v * (1 - this.cashBuffer));
    const accRet = Backtester.accountingReturns(close);
    const engine = new RebalanceEngine(this.rebalancePolicy, {
      periodsPerYear: this.periodsPerYear,
    });
    const reb = engine.run(target, accRet, this.options.benchmarkReturns);
    this.warnings.push(...engine.warnings);
    let portfolioReturns = reb.portfolioReturns;
    if (!portfolioReturns.length) {
      portfolioReturns = reb.returnWeights.values.map((row, r) =>
        row.reduce((s, w, c) => {
          const a = accRet.values[r]![c]!;
          return s + w * (Number.isNaN(a) ? 0 : a);
        }, 0),
      );
    }
    const built = buildWeightLedger({
      actualWeights: reb.actualWeights,
      portfolioReturns,
      prices: close,
      initialCapital: this.initialCapital,
      rebalanceFlags: reb.rebalanceFlags,
      costModel: this.options.weightCostModel ?? new FixedBpsWeightCostModel(1),
      contractSpecResolver: this.spec,
      settlementCurrency: this.baseCurrency,
    });
    this.recordWeightTrades(
      built.positionChanges,
      close,
      built.costBreakdown.transactionCosts,
    );
    const ledger = built.ledger;
    return {
      nav: ledger.nav,
      returns: ledger.returns,
      weights: ledger.weights,
      positions: ledger.positions,
      transactionCosts: built.costBreakdown.totalCost.slice(),
      rebalanceFlags: reb.rebalanceFlags,
      stats: { ...reb.stats },
      ledger,
      fills: [],
    };
  }

  /** core.py _record_trades: implied trades from position changes, column-major then sorted by time. */
  private recordWeightTrades(changes: Frame, close: Frame, costs: Frame): void {
    const rows: Parameters<Blotter['recordTradesBulk']>[0][number][] = [];
    for (const inst of changes.columns) {
      const c = changes.colIndex(inst);
      changes.index.forEach((date, r) => {
        const dq = changes.values[r]![c]!;
        if (!dq || Number.isNaN(dq)) return;
        const price = close.at(date, inst);
        const cost =
          costs.has(date) && costs.colIndex(inst) >= 0
            ? costs.at(date, inst)
            : NaN;
        rows.push({
          timestamp: date,
          instrument: inst,
          side: dq > 0 ? 'buy' : 'sell',
          quantity: Math.abs(dq),
          price,
          tradeValue: Math.abs(dq * price),
          transactionCost: Number.isNaN(cost) ? 0 : cost,
        });
      });
    }
    rows.forEach((row, i) => {
      row.orderId = `order_${i}`;
      row.tradeId = `trade_${i}`;
    });
    // Stable sort by timestamp, like pandas sort_values(kind="mergesort") on ISO dates.
    const pos = new Map(this.dates.map((d, i) => [d, i]));
    rows.sort((a, b) => pos.get(a.timestamp)! - pos.get(b.timestamp)!);
    if (rows.length) this.blotter.recordTradesBulk(rows);
  }

  /** core.py _run_order_simulation. */
  private runOrders(strategy: OrdersStrategy): PathResult {
    const fillEngine = this.makeFillEngine(this.options.fillAt ?? 'open');
    const { ledger, simulator } = this.makeSimulator(
      fillEngine,
      this.options.preTradeRisk ?? new PreTradeRisk(),
    );
    const broker: Broker = {
      fillEngine: fillEngine as unknown as CoreFillEngine,
      getAverageEntryPrice: (inst) => ledger.averageEntryPrice[inst] ?? null,
      contractSpec: (inst) => this.spec(inst),
    };
    strategy.broker = broker;
    const result = simulator.run({
      ...this.simulatorFrames(),
      onBar: (date, bars, positions, nav) =>
        strategy.computeOrders(
          date,
          bars as unknown as Record<string, Bar>,
          positions,
          nav,
        ),
      onFill: (fill, notional) => this.recordFill(fill, notional),
    });
    return this.ordersPathResult(result, fillEngine, {
      rebalanceFlags: new Array<boolean>(this.dates.length).fill(false),
      stats: {},
    });
  }

  /** core.py _run_weight_order_simulation: unshifted targets traded at the next bar by the executor. */
  private runWeightOrders(weights: Frame): PathResult {
    const close = this.feature('close');
    const target = weights.map((v) => v * (1 - this.cashBuffer));
    const planner = new ExecutionRebalanceEngine(this.rebalancePolicy, {
      dates: close.index,
      instruments: this.instruments,
      periodsPerYear: this.periodsPerYear,
      benchmarkReturns: this.options.benchmarkReturns,
    });
    const fillAt =
      this.options.fillAt ?? (planner.policy.rebalanceAt as FillAt);
    const fillEngine = this.makeFillEngine(fillAt);
    const preTrade =
      this.options.preTradeRisk ??
      new PreTradeRisk({ maxMarginUtilization: 1.0 });
    const { simulator } = this.makeSimulator(fillEngine, preTrade);
    const executor = new TargetWeightOrderExecutor({
      targetWeights: target,
      simulator: simulator as unknown as ExecutionSimulator,
      rebalanceEngine: planner,
    });
    const result = simulator.run({
      ...this.simulatorFrames(),
      onBar: (date, bars, positions, nav) => {
        executor.onBar(date, bars, positions, nav);
      },
      onFill: (fill, notional) => {
        executor.onFill(fill, notional);
        this.recordFill(fill, notional);
      },
    });
    return this.ordersPathResult(result, fillEngine, {
      rebalanceFlags: planner.plannedExecutionFlags.slice(),
      stats: {
        ...planner.stats,
        decisionFlags: planner.decisionFlags.slice(),
        submissionFlags: planner.submissionFlags.slice(),
        fillFlags: planner.fillFlags.slice(),
      },
    });
  }
}
