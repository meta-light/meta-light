// Ported from backtester/portfolio/accounting/ledger.py (QuantJourney Backtester, Apache 2.0)
//
// Deterministic portfolio accounting. PortfolioLedger is the stateful owner
// of cash, positions, marks and average entry prices for order simulation;
// buildWeightLedger publishes the same result schema for target-weight mode.

import { Frame, type OrderSide } from '../../../../services/trading/strategies/core';
import {
  type ContractSpecResolver,
  marginRequired,
  notional,
  type PortfolioContractSpec,
  resolveContractSpec,
  validateSettlementCurrency,
} from './contract-spec';
import {
  diffRowsKeepFirst,
  ffillFrame,
  isClose,
  reindexFrame,
} from './frame-utils';
import {
  FixedBpsWeightCostModel,
  solveRecursiveWeightCosts,
  type WeightCostBreakdown,
  type WeightCostModel,
} from './weight-cost';

/** Minimal fill the ledger consumes (subset of the execution Fill). */
export interface LedgerFill {
  instrument: string;
  side: OrderSide;
  quantity: number;
  fillPrice: number;
  commission: number;
}

/** Immutable pre-trade view of the simulated portfolio. */
export interface PortfolioSnapshot {
  cash: number;
  nav: number;
  positions: Readonly<Record<string, number>>;
  prices: Readonly<Record<string, number | null>>;
  marginUsed: number;
  buyingPower: number;
}

/** Accounting values produced while applying one fill. */
export interface FillAccounting {
  tradeNotional: number;
  transactionCashValue: number;
  signedQuantity: number;
  previousPosition: number;
  newPosition: number;
}

/** Common accounting result returned by every simulation mode. */
export interface LedgerResult {
  nav: number[];
  cash: number[];
  positions: Frame;
  positionValues: Frame;
  /** Signed notional exposure / NAV (alias of exposureWeights). */
  weights: Frame;
  /** Accounting mark value / NAV. */
  bookWeights: Frame;
  exposureValues: Frame;
  exposureWeights: Frame;
  returns: number[];
  marginByInstrument: Frame;
  marginUsed: number[];
  buyingPower: number[];
  averageEntryPrice: Readonly<Record<string, number | null>>;
  /** NaN where no position is open. Undefined for weight mode. */
  averageEntryPriceHistory?: Frame;
}

export type PriceMap = Readonly<Record<string, number | null | undefined>>;

const EPS = 1e-12;

/** Single owner of cash, positions, marks and average entry prices. */
export class PortfolioLedger {
  readonly initialCash: number;
  readonly instruments: readonly string[];
  readonly settlementCurrency: string;

  cash = 0;
  positions: Record<string, number> = {};
  averageEntryPrice: Record<string, number | null> = {};
  lastValidPrice: Record<string, number | null> = {};

  private readonly specs = new Map<string, PortfolioContractSpec>();
  private readonly resolver: ContractSpecResolver;
  private dates: string[] = [];
  private navRows: number[] = [];
  private cashRows: number[] = [];
  private positionRows: number[][] = [];
  private positionValueRows: number[][] = [];
  private exposureValueRows: number[][] = [];
  private averageEntryRows: number[][] = [];
  private marginRows: number[][] = [];
  private preparedIndex: readonly string[] | null = null;
  private lastNav = 0;

  constructor(options: {
    initialCash: number;
    instruments: readonly string[];
    contractSpecResolver: ContractSpecResolver;
    settlementCurrency?: string;
  }) {
    this.initialCash = options.initialCash;
    this.instruments = options.instruments.slice();
    this.settlementCurrency = options.settlementCurrency ?? 'USD';
    this.resolver = options.contractSpecResolver;
    // Validate the complete universe before any fill mutates cash.
    for (const instrument of this.instruments) this.contractSpec(instrument);
    this.reset();
  }

  /** Reset all per-run state while preserving configuration. */
  reset(): void {
    this.cash = this.initialCash;
    this.positions = {};
    this.averageEntryPrice = {};
    this.lastValidPrice = {};
    for (const instrument of this.instruments) {
      this.positions[instrument] = 0;
      this.averageEntryPrice[instrument] = null;
      this.lastValidPrice[instrument] = null;
    }
    this.dates = [];
    this.navRows = [];
    this.cashRows = [];
    this.positionRows = [];
    this.positionValueRows = [];
    this.exposureValueRows = [];
    this.averageEntryRows = [];
    this.marginRows = [];
    this.preparedIndex = null;
    this.lastNav = this.initialCash;
  }

  /** Fix the recording index; record() then checks each date against it. */
  prepareHistory(dates: readonly string[]): void {
    this.preparedIndex = dates.slice();
    this.dates = [];
    this.navRows = [];
    this.cashRows = [];
    this.positionRows = [];
    this.positionValueRows = [];
    this.exposureValueRows = [];
    this.averageEntryRows = [];
    this.marginRows = [];
  }

  /** Resolve (and cache) the validated contract specification. */
  contractSpec(instrument: string): PortfolioContractSpec {
    let spec = this.specs.get(instrument);
    if (spec === undefined) {
      spec = resolveContractSpec(instrument, this.resolver(instrument));
      validateSettlementCurrency(spec, this.settlementCurrency);
      this.specs.set(instrument, spec);
    }
    return spec;
  }

  /**
   * Whether a mark is usable. Finite zero and negative prices are legal for
   * non-inverse futures; everything else needs a positive price.
   */
  isValidPrice(value: unknown, instrument?: string): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (instrument === undefined) return value > 0;
    const spec = this.contractSpec(instrument);
    if (spec.assetClass === 'future' && !spec.inverse) return true;
    return value > 0;
  }

  /** Remember the latest usable market price, including futures zero. */
  observeMark(instrument: string, price: unknown): void {
    if (this.isValidPrice(price, instrument))
      this.lastValidPrice[instrument] = price as number;
  }

  /** Resolve current, then last valid, then entry price for valuation. */
  priceForValuation(instrument: string, price: unknown): number | null {
    if (this.isValidPrice(price, instrument)) return price as number;
    const last = this.lastValidPrice[instrument];
    if (last != null && this.isValidPrice(last, instrument)) return last;
    const entry = this.averageEntryPrice[instrument];
    if (entry != null && this.isValidPrice(entry, instrument)) return entry;
    return null;
  }

  /** Absolute exposure notional for commissions and audit. */
  tradeNotional(instrument: string, quantity: number, price: number): number {
    return notional(this.contractSpec(instrument), quantity, price);
  }

  /** Unsigned-quantity transaction value carrying the market price sign. */
  tradeCashValue(instrument: string, quantity: number, price: number): number {
    const spec = this.contractSpec(instrument);
    if (spec.inverse) return notional(spec, quantity, price);
    return Math.abs(quantity) * price * spec.multiplier * spec.lotSize;
  }

  /** Mark a signed position using its contract convention. */
  signedPositionValue(
    instrument: string,
    quantity: number,
    price: number,
  ): number {
    const spec = this.contractSpec(instrument);
    if (spec.inverse)
      return -Math.sign(quantity) * notional(spec, quantity, price);
    return quantity * price * spec.multiplier * spec.lotSize;
  }

  /** Apply one fill atomically to positions, average entry and cash. */
  applyFill(fill: LedgerFill): FillAccounting {
    const previousPosition = this.positions[fill.instrument] ?? 0;
    const signedQuantity = fill.side === 'buy' ? fill.quantity : -fill.quantity;
    const newPosition = previousPosition + signedQuantity;
    this.positions[fill.instrument] = newPosition;
    this.averageEntryPrice[fill.instrument] =
      PortfolioLedger.updatedAverageEntryPrice({
        previousPosition,
        previousAvgPrice: this.averageEntryPrice[fill.instrument] ?? null,
        signedFillQty: signedQuantity,
        fillPrice: fill.fillPrice,
      });

    const tradeNotional = this.tradeNotional(
      fill.instrument,
      fill.quantity,
      fill.fillPrice,
    );
    const cashValue = this.tradeCashValue(
      fill.instrument,
      fill.quantity,
      fill.fillPrice,
    );
    const spec = this.contractSpec(fill.instrument);
    const signedCost = spec.inverse ? -tradeNotional : cashValue;
    if (fill.side === 'buy') this.cash -= signedCost + fill.commission;
    else this.cash += signedCost - fill.commission;

    return {
      tradeNotional,
      transactionCashValue: cashValue,
      signedQuantity,
      previousPosition,
      newPosition,
    };
  }

  /** Per-instrument quantity-based valuation helper shared by the marks below. */
  private perInstrument(
    prices: PriceMap,
    fn: (instrument: string, quantity: number, price: number) => number,
  ): Record<string, number> {
    const out: Record<string, number> = {};
    for (const instrument of this.instruments) {
      const quantity = this.positions[instrument] ?? 0;
      if (Math.abs(quantity) <= EPS) {
        out[instrument] = 0;
        continue;
      }
      const price = this.priceForValuation(instrument, prices[instrument]);
      out[instrument] = price === null ? 0 : fn(instrument, quantity, price);
    }
    return out;
  }

  /** NAV and per-instrument values at current or frozen marks. */
  markToMarket(prices: PriceMap): {
    nav: number;
    positionValues: Record<string, number>;
  } {
    const positionValues = this.perInstrument(prices, (i, q, p) =>
      this.signedPositionValue(i, q, p),
    );
    let total = 0;
    for (const instrument of this.instruments)
      total += positionValues[instrument]!;
    const nav = this.cash + total;
    this.lastNav = nav;
    return { nav, positionValues };
  }

  /** Current collateral requirement per instrument. */
  marginByInstrument(prices: PriceMap = {}): Record<string, number> {
    return this.perInstrument(prices, (i, q, p) =>
      marginRequired(this.contractSpec(i), q, p),
    );
  }

  /** Signed economic exposure, independent of accounting marks. */
  exposureValues(prices: PriceMap = {}): Record<string, number> {
    return this.perInstrument(
      prices,
      (i, q, p) => Math.sign(q) * notional(this.contractSpec(i), q, p),
    );
  }

  /** Signed notional exposure divided by current NAV. */
  exposureWeights(
    options: { prices?: PriceMap; nav?: number } = {},
  ): Record<string, number> {
    const nav = options.nav ?? this.lastNav;
    const out: Record<string, number> = {};
    if (Math.abs(nav) <= EPS) {
      for (const instrument of this.instruments) out[instrument] = 0;
      return out;
    }
    const values = this.exposureValues(options.prices);
    for (const instrument of this.instruments)
      out[instrument] = values[instrument]! / nav;
    return out;
  }

  /** Immutable view for pre-trade checks. */
  snapshot(
    options: { prices?: PriceMap; nav?: number } = {},
  ): PortfolioSnapshot {
    const prices = options.prices ?? {};
    const resolved: Record<string, number | null> = {};
    for (const instrument of this.instruments)
      resolved[instrument] = this.priceForValuation(
        instrument,
        prices[instrument],
      );
    const margin = this.marginByInstrument(prices);
    const nav = options.nav ?? this.lastNav;
    let marginUsed = 0;
    for (const instrument of this.instruments)
      marginUsed += margin[instrument]!;
    return {
      cash: this.cash,
      nav,
      positions: { ...this.positions },
      prices: resolved,
      marginUsed,
      buyingPower: nav - marginUsed,
    };
  }

  /** Append one end-of-bar accounting snapshot. */
  record(input: {
    date: string;
    nav: number;
    positionValues: Readonly<Record<string, number>>;
    prices: PriceMap;
  }): void {
    if (this.preparedIndex !== null) {
      const row = this.dates.length;
      if (row >= this.preparedIndex.length)
        throw new Error('portfolio history buffer is full');
      if (input.date !== this.preparedIndex[row]) {
        throw new Error(
          'portfolio history date does not match the prepared simulation index',
        );
      }
    }
    const margin = this.marginByInstrument(input.prices);
    const exposure = this.exposureValues(input.prices);
    this.dates.push(input.date);
    this.navRows.push(input.nav);
    this.cashRows.push(this.cash);
    this.positionRows.push(this.instruments.map((i) => this.positions[i] ?? 0));
    this.positionValueRows.push(
      this.instruments.map((i) => input.positionValues[i] ?? 0),
    );
    this.exposureValueRows.push(this.instruments.map((i) => exposure[i] ?? 0));
    this.averageEntryRows.push(
      this.instruments.map((i) => this.averageEntryPrice[i] ?? NaN),
    );
    this.marginRows.push(this.instruments.map((i) => margin[i] ?? 0));
  }

  /** Build the recorded outputs and validate the accounting identity. */
  result(): LedgerResult {
    const index = this.dates.slice();
    const cols = this.instruments;
    const frame = (rows: number[][]) =>
      new Frame(
        index,
        cols,
        rows.map((r) => r.slice()),
      );
    const nav = this.navRows.slice();
    const cash = this.cashRows.slice();
    const positionValues = frame(this.positionValueRows);
    const exposureValues = frame(this.exposureValueRows);
    const marginByInstrument = frame(this.marginRows);
    const marginUsed = marginByInstrument.rowSum();
    const exposureWeights = weightsFromPositionValues(exposureValues, nav);
    assertAccountingIdentity(nav, cash, positionValues);
    return {
      nav,
      cash,
      positions: frame(this.positionRows),
      positionValues,
      weights: exposureWeights,
      bookWeights: weightsFromPositionValues(positionValues, nav),
      exposureValues,
      exposureWeights,
      returns: navReturns(nav),
      marginByInstrument,
      marginUsed,
      buyingPower: nav.map((v, i) => v - marginUsed[i]!),
      averageEntryPrice: { ...this.averageEntryPrice },
      averageEntryPriceHistory: frame(this.averageEntryRows),
    };
  }

  /** Average entry after scale-in, reduction, close or reversal. */
  static updatedAverageEntryPrice(input: {
    previousPosition: number;
    previousAvgPrice: number | null;
    signedFillQty: number;
    fillPrice: number;
  }): number | null {
    const { previousPosition, previousAvgPrice, signedFillQty, fillPrice } =
      input;
    const newPosition = previousPosition + signedFillQty;
    if (Math.abs(newPosition) <= EPS) return null;
    if (Math.abs(previousPosition) <= EPS) return fillPrice;
    const sameDirection =
      (previousPosition > 0 && signedFillQty > 0) ||
      (previousPosition < 0 && signedFillQty < 0);
    if (sameDirection) {
      const prevAbs = Math.abs(previousPosition);
      const fillAbs = Math.abs(signedFillQty);
      const prevAvg = previousAvgPrice ?? fillPrice;
      return (prevAvg * prevAbs + fillPrice * fillAbs) / (prevAbs + fillAbs);
    }
    if (
      (previousPosition > 0 && newPosition > 0) ||
      (previousPosition < 0 && newPosition < 0)
    )
      return previousAvgPrice;
    return fillPrice;
  }
}

/** pct_change().fillna(0) on a NAV path. */
function navReturns(nav: readonly number[]): number[] {
  return nav.map((v, i) => {
    if (i === 0) return 0;
    const r = v / nav[i - 1]! - 1;
    return Number.isNaN(r) ? 0 : r;
  });
}

/** Finite realized weights (value / NAV), 0 where NAV is zero. */
export function weightsFromPositionValues(
  positionValues: Frame,
  nav: readonly number[],
): Frame {
  return positionValues.map((v, i) => {
    const w = v / nav[i]!;
    return Number.isFinite(w) ? w : 0;
  });
}

function marginHistory(
  positions: Frame,
  markedPrices: Frame,
  specs: ReadonlyMap<string, PortfolioContractSpec>,
): Frame {
  return positions.map((q, i, j) => {
    const spec = specs.get(positions.columns[j]!)!;
    const price = markedPrices.values[i]![j]!;
    if (!(Math.abs(q) > EPS && Number.isFinite(price))) return 0;
    let required: number;
    if (spec.margin > 0) required = Math.abs(q) * spec.margin;
    else if (spec.inverse)
      required = price !== 0 ? (Math.abs(q) * spec.multiplier) / price : 0;
    else
      required = Math.abs(q) * Math.abs(price) * spec.multiplier * spec.lotSize;
    return Number.isNaN(required) ? 0 : required;
  });
}

export interface BuildWeightLedgerInput {
  actualWeights: Frame;
  /** Gross portfolio returns aligned to actualWeights.index. */
  portfolioReturns: readonly number[];
  prices: Frame;
  initialCapital: number;
  rebalanceFlags: readonly boolean[];
  costModel: WeightCostModel;
  contractSpecResolver: ContractSpecResolver;
  settlementCurrency?: string;
}

export interface BuildWeightLedgerResult {
  ledger: LedgerResult;
  costBreakdown: WeightCostBreakdown;
  positionChanges: Frame;
}

/**
 * Recursive ledger for target-weight mode. Close-to-close with implied (not
 * broker) fills, but positions, audited trades, costs and post-cost NAV all
 * come from one self-financing capital trajectory.
 */
export function buildWeightLedger(
  input: BuildWeightLedgerInput,
): BuildWeightLedgerResult {
  const { actualWeights, costModel } = input;
  const index = actualWeights.index;
  const columns = actualWeights.columns;
  const settlement = input.settlementCurrency ?? 'USD';
  const rawPrices = reindexFrame(input.prices, index, columns);
  const markedPrices = ffillFrame(rawPrices);

  const specs = new Map<string, PortfolioContractSpec>();
  for (const instrument of columns) {
    const spec = resolveContractSpec(
      instrument,
      input.contractSpecResolver(instrument),
    );
    validateSettlementCurrency(spec, settlement);
    specs.set(instrument, spec);
  }
  const tradeUnitValues = rawPrices.map((raw, _i, j) => {
    if (Number.isNaN(raw)) return NaN;
    const spec = specs.get(columns[j]!)!;
    return spec.inverse
      ? spec.multiplier / raw
      : Math.abs(raw) * spec.multiplier * spec.lotSize;
  });

  const { nav, netReturns, breakdown } = solveRecursiveWeightCosts({
    actualWeights,
    prices: input.prices,
    grossReturns: input.portfolioReturns,
    initialCapital: input.initialCapital,
    rebalanceFlags: input.rebalanceFlags,
    costModel,
    tradeUnitValues,
  });

  const n = index.length;
  const m = columns.length;
  const positions: number[][] = [];
  const positionValues: number[][] = [];
  const exposureValues: number[][] = [];
  for (let i = 0; i < n; i++) {
    const qRow = new Array<number>(m).fill(0);
    const vRow = new Array<number>(m).fill(0);
    const eRow = new Array<number>(m).fill(0);
    for (let j = 0; j < m; j++) {
      const spec = specs.get(columns[j]!)!;
      const price = markedPrices.values[i]![j]!;
      const target = actualWeights.values[i]![j]! * nav[i]!;
      const unit = spec.inverse
        ? price !== 0
          ? spec.multiplier / price
          : 0
        : Math.abs(price) * spec.multiplier * spec.lotSize;
      const usable =
        Number.isFinite(price) && Number.isFinite(unit) && unit > 0;
      if (!usable) continue;
      const q = target / unit;
      qRow[j] = q;
      if (spec.inverse) {
        const exposure = (q * spec.multiplier) / price;
        eRow[j] = exposure;
        vRow[j] = -exposure;
      } else {
        eRow[j] = q * Math.abs(price) * spec.multiplier * spec.lotSize;
        vRow[j] = q * price * spec.multiplier * spec.lotSize;
      }
    }
    positions.push(qRow);
    positionValues.push(vRow);
    exposureValues.push(eRow);
  }
  const positionsFrame = new Frame(index, columns, positions);
  const positionValuesFrame = new Frame(index, columns, positionValues);
  const exposureValuesFrame = new Frame(index, columns, exposureValues);
  const pvSum = positionValuesFrame.rowSum();
  const cash = nav.map((v, i) => v - pvSum[i]!);
  const realizedWeights = weightsFromPositionValues(exposureValuesFrame, nav);
  const marginByInstrument = marginHistory(positionsFrame, markedPrices, specs);
  const marginUsed = marginByInstrument.rowSum();

  const flags = index.map((_, i) => input.rebalanceFlags[i] === true);
  const positionChanges = diffRowsKeepFirst(positionsFrame).map((v, i) =>
    flags[i] ? v : 0,
  );

  if (costModel instanceof FixedBpsWeightCostModel) {
    const ok = positionChanges.values.every((row, i) =>
      row.every((v, j) =>
        isClose(v, breakdown.quantityDeltas.values[i]![j]!, 1e-10, 1e-8),
      ),
    );
    if (!ok)
      throw new Error(
        'weight-mode position changes do not reconcile with costed quantity deltas',
      );
  }

  assertAccountingIdentity(nav, cash, positionValuesFrame);
  return {
    ledger: {
      nav,
      cash,
      positions: positionsFrame,
      positionValues: positionValuesFrame,
      weights: realizedWeights,
      bookWeights: weightsFromPositionValues(positionValuesFrame, nav),
      exposureValues: exposureValuesFrame,
      exposureWeights: realizedWeights,
      returns: netReturns,
      marginByInstrument,
      marginUsed,
      buyingPower: nav.map((v, i) => v - marginUsed[i]!),
      averageEntryPrice: {},
    },
    costBreakdown: breakdown,
    positionChanges,
  };
}

/** Fail fast when NAV != cash + sum(position values). */
export function assertAccountingIdentity(
  nav: readonly number[],
  cash: readonly number[],
  positionValues: Frame,
  rtol = 1e-10,
  atol = 1e-8,
): void {
  const pv = positionValues.rowSum();
  const rhs = cash.map((c, i) => c + pv[i]!);
  if (nav.some(Number.isNaN) || rhs.some(Number.isNaN)) {
    throw new Error('Accounting identity inputs contain missing values');
  }
  if (!nav.every((v, i) => isClose(v, rhs[i]!, rtol, atol))) {
    const maxAbs = Math.max(...nav.map((v, i) => Math.abs(v - rhs[i]!)));
    throw new Error(`NAV accounting identity failed; max_abs_diff=${maxAbs}`);
  }
}
