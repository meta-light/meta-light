// Ported from backtester/metrics/formatters.py, metrics/utils.py and
// metrics/configs/portfolio_perf.py (QuantJourney Backtester, Apache 2.0).
//
// Turns the computeMetricResults() dict into display strings, section by
// section. Console colouring and tables are not ported.

type Formatter = (v: unknown) => string;

/** Python's `f"{v:.Nf}"`, including "inf", "-inf" and "nan". */
function fixed(v: unknown, digits: number, grouped = false): string {
  if (typeof v !== 'number') throw new TypeError('not a number');
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  const s = v.toFixed(digits);
  if (!grouped) return s;
  const [int, frac] = s.split('.');
  const sign = int!.startsWith('-') ? '-' : '';
  const digitsOnly = sign ? int!.slice(1) : int!;
  const withCommas = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withCommas}${frac !== undefined ? `.${frac}` : ''}`;
}

const num = (v: unknown): number => {
  if (typeof v !== 'number') throw new TypeError('not a number');
  return v;
};

const currency =
  (digits: number): Formatter =>
  (v) =>
    num(v) < 0
      ? `-$${fixed(Math.abs(num(v)), digits, true)}`
      : `$${fixed(v, digits, true)}`;

export const METRIC_FORMATTERS: Record<string, Formatter> = {
  percentage: (v) => `${fixed(num(v) * 100, 2)}%`, // decimal input: 0.35 -> "35.00%"
  percentage_raw: (v) => `${fixed(v, 2)}%`, // already in percent: 18.5 -> "18.50%"
  ratio: (v) => fixed(v, 2),
  ratio4: (v) => fixed(v, 4),
  ratio6: (v) => fixed(v, 6),
  currency: currency(2), // -1234 -> "-$1,234.00"
  currency0: currency(0), // -1234 -> "-$1,234"
  days: (v) => `${fixed(v, 0)} days`,
  duration: (v) => String(v),
  date: (v) => String(v),
  count: (v) => fixed(v, 0),
  text: (v) => String(v),
  bool: (v) => (v ? '✓' : '✗'),
  definition: (v) => String(v),
  nan: (v) => (typeof v === 'number' && Number.isNaN(v) ? 'nan' : fixed(v, 2)),
};

/** Format one value. Null, NaN and effectively-zero numbers give "". */
export function formatMetric(value: unknown, formatterType: string): string {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'number' && Number.isNaN(value))
  )
    return '';
  if (typeof value === 'boolean' || formatterType === 'bool')
    return METRIC_FORMATTERS.bool!(value);
  if (typeof value === 'number' && Math.abs(value) < 1e-10) return '';
  if (['date', 'duration', 'text', 'definition'].includes(formatterType))
    return String(value);
  const formatter = METRIC_FORMATTERS[formatterType];
  if (!formatter) return String(value);
  try {
    return formatter(value);
  } catch {
    return '';
  }
}

export type MetricPath = readonly [path: string, formatter: string];

/** Report layout: section -> label -> [dotted path into the results, formatter]. */
export const PORTFOLIO_PERF_METRICS: Record<
  string,
  Record<string, MetricPath>
> = {
  Return: {
    'Annualized Return': ['compute_annualized_return', 'percentage'],
    'Total Return': ['cumulative_returns.total_return', 'percentage'],
    MTD: ['compute_periodic_returns.statistics.MTD', 'percentage'],
    QTD: ['compute_periodic_returns.statistics.QTD', 'percentage'],
    YTD: ['compute_periodic_returns.statistics.YTD', 'percentage'],
    '1Y': ['compute_periodic_returns.statistics.1Y', 'percentage'],
    '3Y Annualized': ['compute_periodic_returns.statistics.3Y', 'percentage'],
    '5Y Annualized': ['compute_periodic_returns.statistics.5Y', 'percentage'],
  },
  Risk: {
    'Sharpe Ratio': ['compute_sharpe_ratio', 'ratio'],
    'Sortino Ratio': ['compute_sortino_ratio', 'ratio'],
    'Max Drawdown': ['compute_max_drawdown', 'percentage'],
    'Calmar Ratio': ['compute_advanced_calmar_ratio.base_calmar', 'ratio'],
    'Recovery Factor': ['compute_recovery_factor', 'ratio'],
    'Annualized Volatility': [
      'compute_advanced_annualized_volatility.standard',
      'percentage_raw',
    ],
  },
  Consistency: {
    'Winning Days': ['compute_period_stats.win_days', 'percentage_raw'],
    'Winning Months': ['compute_period_stats.win_month', 'percentage_raw'],
    'Winning Quarters': ['compute_period_stats.win_quarter', 'percentage_raw'],
    'Winning Years': ['compute_period_stats.win_year', 'percentage_raw'],
  },
  Trading: {
    'Average Daily Turnover': [
      'compute_advanced_turnover.average_turnover',
      'percentage_raw',
    ],
    'Annualized Turnover': [
      'compute_advanced_turnover.annualized_turnover',
      'percentage_raw',
    ],
    'Total Turnover': [
      'compute_advanced_turnover.total_turnover',
      'percentage_raw',
    ],
  },
  'Execution Context': {
    'Backtester Version': ['execution_context.backtester_version', 'text'],
    'Data Start': ['execution_context.data_start', 'text'],
    'Data End': ['execution_context.data_end', 'text'],
    'Initial Capital': ['execution_context.initial_capital', 'currency0'],
  },
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Whole years and leftover months between two dates (`relativedelta`). */
function yearsMonths(start: string, end: string): string {
  const a = new Date(start);
  const b = new Date(end);
  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth());
  const dayA = a.getUTCDate() * 86_400_000 + (a.getTime() % 86_400_000);
  const dayB = b.getUTCDate() * 86_400_000 + (b.getTime() % 86_400_000);
  if (months > 0 && dayB < dayA) months -= 1;
  return `${Math.trunc(months / 12)}Y ${months % 12}M`;
}

/**
 * Look up a dotted path. Digit keys index arrays, "latest" takes the last
 * array element, and a missing key gives `fallback`.
 */
export function getNestedValue(
  data: Record<string, unknown>,
  path: string,
  fallback: unknown = 0,
): unknown {
  try {
    const index = data.returns_index as string[] | undefined;
    if (path === 'start_date') return index![0]!.slice(0, 10);
    if (path === 'end_date') return index![index!.length - 1]!.slice(0, 10);
    if (path === 'duration')
      return yearsMonths(index![0]!, index![index!.length - 1]!);
    if (path === 'risk_free_rate') {
      const cfg = isRecord(data.config) ? data.config : {};
      return ((cfg.risk_free_rate as number | undefined) ?? 0) * 100;
    }
    let current: unknown = data;
    for (const key of path.split('.')) {
      if (/^\d+$/.test(key)) {
        if (!Array.isArray(current)) return fallback;
        current = current[Number(key)];
      } else if (isRecord(current)) {
        current = key in current ? current[key] : fallback;
      } else if (Array.isArray(current) && key === 'latest') {
        current = current[current.length - 1];
      } else {
        return fallback;
      }
    }
    return current;
  } catch {
    return fallback;
  }
}

/** Formatted report: section -> label -> display string. */
export function generateReportSections(
  results: Record<string, unknown>,
): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  for (const [section, metrics] of Object.entries(PORTFOLIO_PERF_METRICS)) {
    sections[section] = {};
    for (const [label, [path, formatter]] of Object.entries(metrics)) {
      sections[section]![label] = formatMetric(
        getNestedValue(results, path),
        formatter,
      );
    }
  }
  return sections;
}
