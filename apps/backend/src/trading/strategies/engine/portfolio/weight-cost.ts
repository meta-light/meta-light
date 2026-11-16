import { Frame } from '../../core/index';
import { diffRowsKeepFirst, isClose, reindexFrame } from './frame-utils';

export interface WeightCostBreakdown {
  quantityDeltas: Frame;
  tradeValues: Frame;
  transactionCosts: Frame;
  totalCost: number[];
  totalCostPct: number[];
}

export interface WeightCostInput {
  actualWeights: Frame;
  prices: Frame;
  nav: readonly number[];
  rebalanceFlags: readonly boolean[];
  tradeUnitValues?: Frame;
}

export interface WeightCostModel {
  compute(input: WeightCostInput): WeightCostBreakdown;
}

export class FixedBpsWeightCostModel implements WeightCostModel {
  constructor(
    readonly totalBps = 1.0,
    readonly minTradeValue = 0.0,
  ) {}

  compute({
    actualWeights,
    prices,
    nav,
    rebalanceFlags,
    tradeUnitValues,
  }: WeightCostInput): WeightCostBreakdown {
    const index = actualWeights.index;
    const columns = actualWeights.columns;
    const n = index.length;
    const m = columns.length;
    const px = reindexFrame(prices, index, columns);
    const unit =
      tradeUnitValues === undefined
        ? px.map(Math.abs)
        : reindexFrame(tradeUnitValues, index, columns);

    const navAligned: number[] = [];
    let lastNav = NaN;
    for (let i = 0; i < n; i++) {
      const v = nav[i];
      if (v !== undefined && !Number.isNaN(v)) lastNav = v;
      navAligned.push(Number.isNaN(lastNav) ? 0 : lastNav);
    }
    const flags = index.map((_, i) => rebalanceFlags[i] === true);

    const lastUnit = new Array<number>(m).fill(NaN);
    const safeUnit = unit.values.map((row) =>
      row.map((v, j) => {
        const a = Math.abs(v);
        if (!Number.isNaN(a) && a !== 0) lastUnit[j] = a;
        return lastUnit[j]!;
      }),
    );

    const targetQuantities = new Frame(
      index,
      columns,
      actualWeights.values.map((row, i) =>
        row.map((w, j) => {
          const q = (w * navAligned[i]!) / safeUnit[i]![j]!;
          return Number.isFinite(q) ? q : 0;
        }),
      ),
    );

    const deltas = diffRowsKeepFirst(targetQuantities).values.map((row, i) =>
      row.map((d, j) => {
        if (!flags[i]) return 0;
        if (Number.isNaN(px.values[i]![j]!)) return 0;
        return d;
      }),
    );
    const quantityDeltas = new Frame(index, columns, deltas);

    const tv = deltas.map((row, i) =>
      row.map((d, j) => {
        const v = Math.abs(d) * Math.abs(unit.values[i]![j]!);
        return Number.isFinite(v) ? v : 0;
      }),
    );
    const tradeValues = new Frame(index, columns, tv);

    const rate = this.totalBps / 10_000;
    const costs = tv.map((row) =>
      row.map(
        (v) =>
          (this.minTradeValue > 0 && v < this.minTradeValue ? 0 : v) * rate,
      ),
    );
    const transactionCosts = new Frame(index, columns, costs);
    const totalCost = costs.map((row) => row.reduce((s, v) => s + v, 0));
    const totalCostPct = totalCost.map((c, i) => {
      const nv = navAligned[i]!;
      if (nv === 0) return 0;
      const p = c / nv;
      return Number.isFinite(p) ? p : 0;
    });

    return {
      quantityDeltas,
      tradeValues,
      transactionCosts,
      totalCost,
      totalCostPct,
    };
  }
}

export interface SolveRecursiveWeightCostsInput {
  actualWeights: Frame;
  prices: Frame;
  grossReturns: readonly number[];
  initialCapital: number;
  rebalanceFlags: readonly boolean[];
  costModel: WeightCostModel;
  tradeUnitValues?: Frame;
  maxIterations?: number;
  rtol?: number;
  atol?: number;
}

export interface SolveRecursiveWeightCostsResult {
  nav: number[];
  netReturns: number[];
  breakdown: WeightCostBreakdown;
}

export function solveRecursiveWeightCosts(
  input: SolveRecursiveWeightCostsInput,
): SolveRecursiveWeightCostsResult {
  const { actualWeights, costModel, tradeUnitValues } = input;
  const initialCapital = input.initialCapital;
  const maxIterations = input.maxIterations ?? 100;
  const rtol = input.rtol ?? 1e-12;
  const atol = input.atol ?? 1e-8;
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
    throw new Error('initial_capital must be finite and positive');
  }
  if (maxIterations <= 0) throw new Error('max_iterations must be positive');

  const index = actualWeights.index;
  const n = index.length;
  const prices = reindexFrame(input.prices, index, actualWeights.columns);
  const returns = index.map((_, i) => input.grossReturns[i] ?? NaN);
  if (returns.some((r) => !Number.isFinite(r))) {
    throw new Error(
      'gross_returns must be finite on the complete weight index',
    );
  }
  const flags = index.map((_, i) => input.rebalanceFlags[i] === true);
  const unitValues =
    tradeUnitValues === undefined
      ? undefined
      : reindexFrame(tradeUnitValues, index, actualWeights.columns);

  const breakdownFor = (nav: readonly number[]): WeightCostBreakdown =>
    costModel.compute({
      actualWeights,
      prices,
      nav,
      rebalanceFlags: flags,
      tradeUnitValues: unitValues,
    });

  let acc = initialCapital;
  let candidate = returns.map((r) => (acc *= 1 + r));
  if (n === 0) {
    return {
      nav: candidate,
      netReturns: [],
      breakdown: breakdownFor(candidate),
    };
  }

  const allClose = (a: readonly number[], b: readonly number[]) =>
    a.every((v, i) => isClose(v, b[i]!, rtol, atol));

  let converged = false;
  for (let iter = 0; iter < maxIterations; iter++) {
    const next = navAfterCosts(
      returns,
      validatedTotalCost(breakdownFor(candidate).totalCost, n),
      initialCapital,
    );
    const close = allClose(next, candidate);
    candidate = next;
    if (close) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    throw new Error(
      'weight-cost accounting did not converge; check leverage and the cost model',
    );
  }

  const breakdown = breakdownFor(candidate);
  const nav = navAfterCosts(
    returns,
    validatedTotalCost(breakdown.totalCost, n),
    initialCapital,
  );
  if (!allClose(nav, candidate)) {
    throw new Error(
      'weight-cost accounting failed its final fixed-point reconciliation',
    );
  }
  const netReturns = nav.map(
    (v, i) => v / (i === 0 ? initialCapital : nav[i - 1]!) - 1,
  );
  return { nav, netReturns, breakdown };
}

function validatedTotalCost(costs: readonly number[], n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => costs[i] ?? NaN);
  if (out.some((c) => !Number.isFinite(c) || c < 0)) {
    throw new Error(
      'weight cost model must return finite, non-negative total costs',
    );
  }
  return out;
}

function navAfterCosts(
  returns: readonly number[],
  costs: readonly number[],
  initialCapital: number,
): number[] {
  let previous = initialCapital;
  return returns.map((r, i) => {
    const after = previous * (1 + r) - costs[i]!;
    if (!Number.isFinite(after) || after <= 0) {
      throw new Error(
        'weight-mode NAV became non-positive; check leverage, returns, and costs',
      );
    }
    previous = after;
    return after;
  });
}
