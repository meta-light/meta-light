import { type Bar, OrdersStrategy, type StrategyConfig, topN } from '../core/index';

export const config: StrategyConfig = {
  strategyName: 'MonthlyRotationOrders',
  strategyType: 'Momentum Rotation',
  initialCapital: 100_000,
  instruments: ['SPY', 'EFA', 'EEM', 'TLT', 'IEF', 'GLD', 'DBC', 'VNQ'],
  backtestPeriod: { start: '2007-01-03', end: '2026-01-01' },
  benchmarkSymbol: 'SPY',
  benchmarkName: 'SPDR S&P 500 ETF Trust',
  source: 'yfinance',
  executionMode: 'orders',
  maxPositionSize: 0.4,
  indicators: [],
  slippage: { type: 'fixed_bps', bps: 3.0 },
  commission: { type: 'per_share', costPerShare: 0.005, minPerOrder: 1.0 },
};

export class MonthlyRotationOrders extends OrdersStrategy {
  static readonly LOOKBACK = 126; // ~6 months
  static readonly TOP_N = 3;

  private lastMonth: string | null = null;

  constructor(cfg: StrategyConfig = config) {
    super(cfg);
  }

  computeOrders(
    date: string,
    bars: Record<string, Bar>,
    positions: Record<string, number>,
    nav: number,
  ): void {
    const { LOOKBACK, TOP_N } = MonthlyRotationOrders;

    const monthKey = date.slice(0, 7);
    if (monthKey === this.lastMonth) return;
    this.lastMonth = monthKey;

    const close = this.data.getFeature('adj_close');
    const posIdx = close.rowIndex(date);
    if (posIdx < 0 || posIdx < LOOKBACK) return;

    const now = close.row(posIdx);
    const then = close.row(posIdx - LOOKBACK);
    const momentum = now.map((v, j) => v / then[j]! - 1);
    const target = topN(momentum, close.columns, TOP_N);

    for (const inst of this.instruments) {
      const pos = positions[inst] ?? 0;
      if (pos > 0 && !target.includes(inst)) {
        this.submit({
          instrument: inst,
          side: 'sell',
          quantity: pos,
          orderType: 'market',
        });
      }
    }

    const perNameNav = nav / Math.max(1, target.length);
    for (const inst of target) {
      if ((positions[inst] ?? 0) === 0) {
        const shares = Math.trunc(perNameNav / bars[inst]!.close);
        if (shares > 0)
          this.submit({
            instrument: inst,
            side: 'buy',
            quantity: shares,
            orderType: 'market',
          });
      }
    }
  }
}
