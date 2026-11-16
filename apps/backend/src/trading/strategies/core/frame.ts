export type Cell = (value: number, row: number, col: number) => number;

export class Frame {
  constructor(
    readonly index: readonly string[],
    readonly columns: readonly string[],
    readonly values: number[][],
  ) {}

  static full(
    index: readonly string[],
    columns: readonly string[],
    fill: number,
  ): Frame {
    return new Frame(
      index,
      columns,
      index.map(() => columns.map(() => fill)),
    );
  }

  static fromColumns(
    index: readonly string[],
    cols: Record<string, readonly number[]>,
  ): Frame {
    const columns = Object.keys(cols);
    return new Frame(
      index,
      columns,
      index.map((_, i) => columns.map((c) => cols[c]![i] ?? NaN)),
    );
  }

  get length(): number {
    return this.index.length;
  }

  colIndex(name: string): number {
    return this.columns.indexOf(name);
  }

  rowIndex(date: string): number {
    return this.index.indexOf(date);
  }

  has(date: string): boolean {
    return this.rowIndex(date) >= 0;
  }

  col(name: string): number[] {
    const j = this.colIndex(name);
    if (j < 0) throw new Error(`Unknown column ${name}`);
    return this.values.map((row) => row[j]!);
  }

  row(i: number): number[] {
    return [...this.values[i]!];
  }

  rowRecord(i: number): Record<string, number> {
    return Object.fromEntries(
      this.columns.map((c, j) => [c, this.values[i]![j]!]),
    );
  }

  at(date: string, col: string): number {
    const i = this.rowIndex(date);
    const j = this.colIndex(col);
    return i < 0 || j < 0 ? NaN : this.values[i]![j]!;
  }

  iat(i: number, col: string): number {
    return this.values[i]?.[this.colIndex(col)] ?? NaN;
  }

  map(fn: Cell): Frame {
    return new Frame(
      this.index,
      this.columns,
      this.values.map((row, i) => row.map((v, j) => fn(v, i, j))),
    );
  }

  zip(
    other: Frame,
    fn: (a: number, b: number, row: number, col: number) => number,
  ): Frame {
    return this.map((v, i, j) => fn(v, other.values[i]?.[j] ?? NaN, i, j));
  }

  mapCols(fn: (col: number[], name: string) => number[]): Frame {
    const cols = this.columns.map((c) => fn(this.col(c), c));
    return new Frame(
      this.index,
      this.columns,
      this.index.map((_, i) => cols.map((col) => col[i]!)),
    );
  }

  mapRows(fn: (row: number[], i: number) => number[]): Frame {
    return new Frame(
      this.index,
      this.columns,
      this.values.map((row, i) => fn([...row], i)),
    );
  }

  shift(n = 1): Frame {
    return this.mapCols((col) => shift(col, n));
  }

  pctChange(n = 1): Frame {
    return this.mapCols((col) => pctChange(col, n));
  }

  rolling(
    window: number,
    fn: (win: number[]) => number,
    minPeriods = window,
  ): Frame {
    return this.mapCols((col) => rolling(col, window, fn, minPeriods));
  }

  rollingMean(window: number, minPeriods = window): Frame {
    return this.rolling(window, mean, minPeriods);
  }

  rollingStd(window: number, minPeriods = window): Frame {
    return this.rolling(window, std, minPeriods);
  }

  ewmMean(span: number, adjust = true): Frame {
    return this.mapCols((col) => ewmMean(col, span, adjust));
  }

  where(
    cond: (value: number, row: number, col: number) => boolean,
    other: number,
  ): Frame {
    return this.map((v, i, j) => (cond(v, i, j) ? v : other));
  }

  fillNaN(value: number): Frame {
    return this.map((v) => (Number.isNaN(v) ? value : v));
  }

  clip(lower = -Infinity, upper = Infinity): Frame {
    return this.map((v) =>
      Number.isNaN(v) ? v : Math.min(Math.max(v, lower), upper),
    );
  }

  rowSum(): number[] {
    return this.values.map((row) =>
      row.reduce((s, v) => (Number.isNaN(v) ? s : s + v), 0),
    );
  }

  divRows(denoms: readonly number[]): Frame {
    return this.map((v, i) => v / denoms[i]!);
  }

  mulRows(factors: readonly number[]): Frame {
    return this.map((v, i) => v * factors[i]!);
  }

  filterRows(keep: (date: string, i: number) => boolean): Frame {
    const rows = this.index
      .map((d, i) => [d, i] as const)
      .filter(([d, i]) => keep(d, i));
    return new Frame(
      rows.map(([d]) => d),
      this.columns,
      rows.map(([, i]) => [...this.values[i]!]),
    );
  }
}

export const isNum = (v: number): boolean => !Number.isNaN(v);

export function sum(xs: readonly number[]): number {
  return xs.reduce((s, v) => s + v, 0);
}

export function mean(xs: readonly number[]): number {
  return xs.length ? sum(xs) / xs.length : NaN;
}

export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
}

export function std(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

export function covariance(
  xs: readonly number[],
  ys: readonly number[],
): number {
  if (xs.length < 2) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  return (
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / (xs.length - 1)
  );
}

export function shift(xs: readonly number[], n = 1): number[] {
  return xs.map((_, i) => (i - n >= 0 && i - n < xs.length ? xs[i - n]! : NaN));
}

export function pctChange(xs: readonly number[], n = 1): number[] {
  return xs.map((v, i) => (i >= n ? v / xs[i - n]! - 1 : NaN));
}

export function rolling(
  xs: readonly number[],
  window: number,
  fn: (win: number[]) => number,
  minPeriods = window,
): number[] {
  return xs.map((_, i) => {
    if (i + 1 < window && i + 1 < minPeriods) return NaN;
    const win = xs.slice(Math.max(0, i - window + 1), i + 1).filter(isNum);
    return win.length >= minPeriods ? fn(win) : NaN;
  });
}

export function rollingCov(
  xs: readonly number[],
  ys: readonly number[],
  window: number,
): number[] {
  return xs.map((_, i) => {
    if (i + 1 < window) return NaN;
    const a: number[] = [];
    const b: number[] = [];
    for (let k = i - window + 1; k <= i; k++) {
      if (isNum(xs[k]!) && isNum(ys[k]!)) {
        a.push(xs[k]!);
        b.push(ys[k]!);
      }
    }
    return a.length >= window ? covariance(a, b) : NaN;
  });
}

export function ewmMean(
  xs: readonly number[],
  span: number,
  adjust = true,
): number[] {
  const alpha = 2 / (span + 1);
  const out: number[] = [];
  if (adjust) {
    let num = 0;
    let den = 0;
    for (const x of xs) {
      num *= 1 - alpha;
      den *= 1 - alpha;
      if (isNum(x)) {
        num += x;
        den += 1;
      }
      out.push(den > 0 ? num / den : NaN);
    }
    return out;
  }
  let prev = NaN;
  for (const x of xs) {
    if (isNum(x))
      prev = Number.isNaN(prev) ? x : (1 - alpha) * prev + alpha * x;
    out.push(prev);
  }
  return out;
}

export function topN(
  row: readonly number[],
  columns: readonly string[],
  n: number,
  order: 'largest' | 'smallest' = 'largest',
): string[] {
  const sign = order === 'largest' ? -1 : 1;
  return row
    .map((v, j) => ({ v, j }))
    .filter(({ v }) => isNum(v))
    .sort((a, b) => sign * (a.v - b.v) || a.j - b.j)
    .slice(0, n)
    .map(({ j }) => columns[j]!);
}

export function equalWeightActive(signals: Frame, cap = Infinity): Frame {
  const active = signals.map((v) => (v === 1 ? 1 : 0));
  return active.divRows(active.rowSum()).fillNaN(0).clip(-Infinity, cap);
}

export function crossAbove(fast: Frame, slow: Frame): Frame {
  return fast.zip(slow, (f, s) => (isNum(f) && isNum(s) && f > s ? 1 : 0));
}
