// Static defaults only; the cloud metadata lookup is not ported.
//
// Ported from backtester/execution/contract_spec.py (QuantJourney Backtester, Apache 2.0)

import type { ContractSpec as CoreContractSpec } from '../../core/index';

export type AssetClass = 'equity' | 'future' | 'fx' | 'crypto' | 'option';
const ASSET_CLASSES: readonly AssetClass[] = [
  'equity',
  'future',
  'fx',
  'crypto',
  'option',
];

export class UnsupportedCurrencyConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedCurrencyConversionError';
  }
}

function currencyCode(value: unknown, fieldName: string): string {
  if (typeof value !== 'string')
    throw new TypeError(`${fieldName} must be a string, got ${typeof value}`);
  const normalized = value.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9]+$/.test(normalized)) {
    throw new Error(
      `${fieldName} must be a non-empty alphanumeric currency code, got ${JSON.stringify(value)}`,
    );
  }
  return normalized;
}

export interface ContractSpecInit {
  symbol: string;
  assetClass?: AssetClass;
  multiplier?: number;
  tickSize?: number;
  margin?: number;
  lotSize?: number;
  /** `null` means no quantity rounding (fractional units). */
  quantityStep?: number | null;
  minQuantity?: number;
  pipSize?: number;
  quoteCurrency?: string;
  baseCurrency?: string;
  exchange?: string;
  calendar?: string;
  instrumentType?: string;
  providerSymbol?: string;
  continuous?: boolean;
  inverse?: boolean;
}

type Overrides = Omit<ContractSpecInit, 'symbol'>;

/**
 * Immutable, validated contract spec. Structurally satisfies the core
 * `ContractSpec` ({multiplier, margin, lotSize}) so strategies can use it.
 */
export class FullContractSpec implements CoreContractSpec {
  readonly symbol: string;
  readonly assetClass: AssetClass;
  readonly multiplier: number;
  readonly tickSize: number;
  readonly margin: number;
  readonly lotSize: number;
  readonly quantityStep: number | null;
  readonly minQuantity: number;
  readonly pipSize: number;
  readonly quoteCurrency: string;
  readonly baseCurrency?: string;
  readonly exchange?: string;
  readonly calendar?: string;
  readonly instrumentType?: string;
  readonly providerSymbol?: string;
  readonly continuous: boolean;
  readonly inverse: boolean;

  constructor(init: ContractSpecInit) {
    if (typeof init.symbol !== 'string' || !init.symbol.trim())
      throw new Error('symbol must be a non-empty string');
    const assetClass = init.assetClass ?? 'equity';
    if (!ASSET_CLASSES.includes(assetClass))
      throw new TypeError(
        `asset_class must be one of ${ASSET_CLASSES.join(', ')}`,
      );

    const positive = {
      multiplier: init.multiplier ?? 1,
      tickSize: init.tickSize ?? 0.01,
      lotSize: init.lotSize ?? 1,
      pipSize: init.pipSize ?? 0.0001,
    };
    const nonNegative = {
      margin: init.margin ?? 0,
      minQuantity: init.minQuantity ?? 0,
    };
    for (const [name, v] of Object.entries(positive)) {
      if (typeof v !== 'number')
        throw new TypeError(`${name} must be numeric, got ${String(v)}`);
      if (!Number.isFinite(v))
        throw new Error(`${name} must be finite, got ${v}`);
      if (v <= 0)
        throw new Error(`${name} must be greater than zero, got ${v}`);
    }
    for (const [name, v] of Object.entries(nonNegative)) {
      if (typeof v !== 'number')
        throw new TypeError(`${name} must be numeric, got ${String(v)}`);
      if (!Number.isFinite(v))
        throw new Error(`${name} must be finite, got ${v}`);
      if (v < 0) throw new Error(`${name} must be non-negative, got ${v}`);
    }
    const step = init.quantityStep === undefined ? 1 : init.quantityStep;
    if (
      step !== null &&
      (typeof step !== 'number' || !Number.isFinite(step) || step <= 0)
    ) {
      throw new Error(
        `quantity_step must be finite and greater than zero, got ${String(step)}`,
      );
    }

    this.symbol = init.symbol;
    this.assetClass = assetClass;
    this.multiplier = positive.multiplier;
    this.tickSize = positive.tickSize;
    this.lotSize = positive.lotSize;
    this.pipSize = positive.pipSize;
    this.margin = nonNegative.margin;
    this.minQuantity = nonNegative.minQuantity;
    this.quantityStep = step;
    this.quoteCurrency = currencyCode(
      init.quoteCurrency ?? 'USD',
      'quote_currency',
    );
    this.baseCurrency =
      init.baseCurrency === undefined
        ? undefined
        : currencyCode(init.baseCurrency, 'base_currency');
    this.exchange = init.exchange;
    this.calendar = init.calendar;
    this.instrumentType = init.instrumentType;
    this.providerSymbol = init.providerSymbol;
    this.continuous = init.continuous ?? false;
    this.inverse = init.inverse ?? false;
    Object.freeze(this);
  }

  /** Fail if FX quote amounts would need a currency conversion that does not exist. */
  validateSettlementCurrency(settlementCurrency: string): void {
    if (this.assetClass !== 'fx') return;
    const settlement = currencyCode(settlementCurrency, 'settlement_currency');
    if (this.quoteCurrency !== settlement) {
      throw new UnsupportedCurrencyConversionError(
        `FX contract ${JSON.stringify(this.symbol)} produces notional and PnL in ${this.quoteCurrency}, ` +
          `but the portfolio settles in ${settlement}. Currency conversion is not implemented; use a ` +
          'matching portfolio currency or an instrument quoted in the portfolio currency.',
      );
    }
  }

  static equity(symbol: string, overrides: Overrides = {}): FullContractSpec {
    return new FullContractSpec({
      symbol,
      assetClass: 'equity',
      multiplier: 1,
      tickSize: 0.01,
      lotSize: 1,
      quantityStep: 1,
      margin: 0,
      ...overrides,
    });
  }

  static future(
    symbol: string,
    multiplier: number,
    tickSize = 0.25,
    margin = 0,
    overrides: Overrides = {},
  ): FullContractSpec {
    return new FullContractSpec({
      symbol,
      assetClass: 'future',
      multiplier,
      tickSize,
      lotSize: 1,
      quantityStep: 1,
      margin,
      ...overrides,
    });
  }

  static fx(
    symbol: string,
    lotSize = 100_000,
    pipSize = 0.0001,
    overrides: Overrides = {},
  ): FullContractSpec {
    return new FullContractSpec({
      symbol,
      assetClass: 'fx',
      multiplier: 1,
      tickSize: pipSize,
      lotSize,
      pipSize,
      quantityStep: 0.01,
      margin: 0,
      ...overrides,
    });
  }

  static crypto(symbol: string, overrides: Overrides = {}): FullContractSpec {
    return new FullContractSpec({
      symbol,
      assetClass: 'crypto',
      multiplier: 1,
      tickSize: 0.01,
      lotSize: 1,
      quantityStep: null,
      margin: 0,
      ...overrides,
    });
  }

  /** Absolute notional exposure of a position. */
  notional(quantity: number, price: number): number {
    if (this.inverse)
      return price !== 0 ? (Math.abs(quantity) * this.multiplier) / price : 0;
    return (
      Math.abs(quantity) * Math.abs(price) * this.multiplier * this.lotSize
    );
  }

  /** Round-trip PnL. Inverse contracts use quantity * multiplier * (1/entry - 1/exit). */
  pnl(quantity: number, entryPrice: number, exitPrice: number): number {
    if (this.inverse) {
      if (entryPrice === 0 || exitPrice === 0) return 0;
      return quantity * this.multiplier * (1 / entryPrice - 1 / exitPrice);
    }
    return quantity * (exitPrice - entryPrice) * this.multiplier * this.lotSize;
  }

  marginRequired(quantity: number, price: number): number {
    if (this.margin > 0) return Math.abs(quantity) * this.margin;
    return this.notional(quantity, price);
  }

  roundPrice(price: number): number {
    if (this.tickSize <= 0) return price;
    return roundHalfEven(
      roundHalfEven(price / this.tickSize, 0) * this.tickSize,
      10,
    );
  }

  /** Round toward zero to the executable quantity increment. */
  roundQuantity(quantity: number): number {
    if (!Number.isFinite(quantity)) throw new Error('quantity must be finite');
    let rounded = quantity;
    if (this.quantityStep !== null) {
      const tolerance = quantity ? Math.sign(quantity) * 1e-12 : 0;
      rounded = roundHalfEven(
        Math.trunc(quantity / this.quantityStep + tolerance) *
          this.quantityStep,
        12,
      );
    }
    if (Math.abs(rounded) + 1e-12 < this.minQuantity) return 0;
    return rounded;
  }
}

/** Python's round(): half-to-even at the given number of decimals. */
function roundHalfEven(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let r: number;
  if (diff > 0.5) r = floor + 1;
  else if (diff < 0.5) r = floor;
  else r = floor % 2 === 0 ? floor : floor + 1;
  return r / factor;
}

export const COMMON_SPECS: Readonly<Record<string, FullContractSpec>> =
  Object.freeze({
    ES: FullContractSpec.future('ES', 50, 0.25, 15_840),
    NQ: FullContractSpec.future('NQ', 20, 0.25, 21_000),
    YM: FullContractSpec.future('YM', 5, 1.0, 11_000),
    RTY: FullContractSpec.future('RTY', 50, 0.1, 8_000),
    MES: FullContractSpec.future('MES', 5, 0.25, 1_584),
    MNQ: FullContractSpec.future('MNQ', 2, 0.25, 2_100),
    ZN: FullContractSpec.future('ZN', 1000, 1 / 64, 2_200),
    ZB: FullContractSpec.future('ZB', 1000, 1 / 32, 4_400),
    CL: FullContractSpec.future('CL', 1000, 0.01, 7_000),
    NG: FullContractSpec.future('NG', 10_000, 0.001, 7_500),
    GC: FullContractSpec.future('GC', 100, 0.1, 10_000),
    SI: FullContractSpec.future('SI', 5_000, 0.005, 14_000),
    HG: FullContractSpec.future('HG', 25_000, 0.0005, 6_000),
    ZC: FullContractSpec.future('ZC', 50, 0.25, 2_500),
    ZS: FullContractSpec.future('ZS', 50, 0.25, 3_500),
    ZW: FullContractSpec.future('ZW', 50, 0.25, 3_000),
    LE: FullContractSpec.future('LE', 400, 0.025, 2_500),
    HE: FullContractSpec.future('HE', 400, 0.025, 2_500),
    EURUSD: FullContractSpec.fx('EURUSD', 100_000, 0.0001, {
      baseCurrency: 'EUR',
    }),
    GBPUSD: FullContractSpec.fx('GBPUSD', 100_000, 0.0001, {
      baseCurrency: 'GBP',
    }),
    USDJPY: FullContractSpec.fx('USDJPY', 100_000, 0.01, {
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
    }),
    AUDUSD: FullContractSpec.fx('AUDUSD', 100_000, 0.0001, {
      baseCurrency: 'AUD',
    }),
    NZDUSD: FullContractSpec.fx('NZDUSD', 100_000, 0.0001, {
      baseCurrency: 'NZD',
    }),
    USDCAD: FullContractSpec.fx('USDCAD', 100_000, 0.0001, {
      baseCurrency: 'USD',
      quoteCurrency: 'CAD',
    }),
    USDCHF: FullContractSpec.fx('USDCHF', 100_000, 0.0001, {
      baseCurrency: 'USD',
      quoteCurrency: 'CHF',
    }),
    BTCUSD: FullContractSpec.crypto('BTCUSD'),
    ETHUSD: FullContractSpec.crypto('ETHUSD'),
  });

/**
 * Build and strictly validate a spec from external metadata (snake_case keys,
 * as the Python `/bt/prepare` contract delivers them). Pure parsing, no I/O.
 */
export function contractSpecFromMapping(
  symbol: string,
  values: Readonly<Record<string, unknown>>,
): FullContractSpec {
  const prefix = `Invalid contract spec for ${JSON.stringify(symbol)}:`;
  const has = (name: string): boolean =>
    Object.prototype.hasOwnProperty.call(values, name);
  const present = (name: string): boolean =>
    has(name) && values[name] !== null && values[name] !== undefined;
  const truthy = (name: string): boolean => Boolean(values[name]);

  const requireFields = (assetName: string, ...names: string[]): void => {
    const missing = names.filter((n) => !present(n));
    if (missing.length)
      throw new Error(
        `${prefix} ${assetName} metadata requires explicit field(s): ${missing.join(', ')}`,
      );
  };

  const symbolFxPair = (): [string, string] | null => {
    let canonical = String(symbol).trim().toUpperCase();
    if (canonical.endsWith('=X')) canonical = canonical.slice(0, -2);
    for (const sep of ['/', '_', '-']) {
      const parts = canonical.split(sep);
      if (parts.length === 2 && parts.every((p) => /^[A-Z]{3}$/.test(p)))
        return [parts[0]!, parts[1]!];
    }
    if (/^[A-Z]{6}$/.test(canonical))
      return [canonical.slice(0, 3), canonical.slice(3)];
    return null;
  };

  const num = (name: string, fallback: number): number => {
    if (!has(name)) return fallback;
    const value = values[name];
    if (value === null || value === undefined || typeof value === 'boolean') {
      throw new Error(
        `${prefix} ${name} must be a finite number, got ${String(value)}`,
      );
    }
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : NaN;
    if (
      Number.isNaN(numeric) &&
      !(typeof value === 'string' && value.trim().toLowerCase() === 'nan')
    ) {
      throw new Error(
        `${prefix} ${name} must be numeric, got ${String(value)}`,
      );
    }
    if (!Number.isFinite(numeric))
      throw new Error(`${prefix} ${name} must be finite, got ${String(value)}`);
    return numeric;
  };

  const bool = (name: string, fallback: boolean): boolean => {
    if (!has(name)) return fallback;
    const value = values[name];
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === 1) return value === 1;
    if (typeof value === 'string') {
      const n = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(n)) return true;
      if (['0', 'false', 'no', 'off'].includes(n)) return false;
    }
    throw new Error(
      `${prefix} ${name} must be a boolean, got ${String(value)}`,
    );
  };

  requireFields('instrument', 'asset_class');
  const rawValue = values['asset_class'];
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw new Error(
      `${prefix} asset_class must be a non-empty string, got ${String(rawValue)}`,
    );
  }
  const aliases: Record<string, AssetClass> = {
    futures: 'future',
    future_continuous: 'future',
    spot_fx: 'fx',
    currency: 'fx',
  };
  const raw = rawValue.trim().toLowerCase();
  const assetClass = (aliases[raw] ?? raw) as AssetClass;
  if (!ASSET_CLASSES.includes(assetClass)) {
    throw new Error(
      `${prefix} unsupported asset_class ${JSON.stringify(rawValue)}; expected one of: ${ASSET_CLASSES.join(', ')}`,
    );
  }

  if (assetClass === 'fx')
    requireFields('FX', 'base_currency', 'quote_currency', 'lot_size');
  else if (assetClass === 'future') requireFields('future', 'multiplier');

  const quoteCurrency = has('quote_currency')
    ? currencyCode(values['quote_currency'], 'quote_currency')
    : 'USD';
  const common: Overrides = {
    quoteCurrency,
    baseCurrency: present('base_currency')
      ? currencyCode(values['base_currency'], 'base_currency')
      : undefined,
    exchange: truthy('exchange') ? String(values['exchange']) : undefined,
    calendar: truthy('calendar') ? String(values['calendar']) : undefined,
    instrumentType: truthy('instrument_type')
      ? String(values['instrument_type'])
      : undefined,
    providerSymbol: String(values['provider_symbol'] || symbol),
    continuous: bool('continuous', false),
    inverse: bool('inverse', false),
  };

  if (assetClass === 'fx') {
    const base = common.baseCurrency;
    if (base === quoteCurrency)
      throw new Error(
        `${prefix} base_currency and quote_currency must differ for FX, got ${base}`,
      );
    const pair = symbolFxPair();
    if (pair && (pair[0] !== base || pair[1] !== quoteCurrency)) {
      throw new Error(
        `${prefix} FX symbol implies ${pair[0]}/${pair[1]}, but metadata declares ${base}/${quoteCurrency}`,
      );
    }
  }
  if (present('quantity_step')) common.quantityStep = num('quantity_step', 1);
  if (present('min_quantity')) common.minQuantity = num('min_quantity', 0);

  const tickSize = num('tick_size', 0.01);
  const margin = num('margin', 0);
  const multiplier = num('multiplier', 1);
  const lotSize = num('lot_size', 1);

  if (assetClass === 'future')
    return FullContractSpec.future(symbol, multiplier, tickSize, margin, {
      lotSize,
      ...common,
    });
  if (assetClass === 'fx') {
    const pipSize = num('pip_size', quoteCurrency === 'JPY' ? 0.01 : 0.0001);
    return FullContractSpec.fx(symbol, lotSize, pipSize, {
      tickSize: num('tick_size', pipSize),
      margin,
      multiplier,
      ...common,
    });
  }
  if (assetClass === 'crypto')
    return FullContractSpec.crypto(symbol, {
      multiplier,
      tickSize,
      margin,
      lotSize,
      ...common,
    });
  return new FullContractSpec({
    symbol,
    assetClass,
    multiplier,
    tickSize,
    margin,
    lotSize,
    pipSize: num('pip_size', 0.0001),
    ...common,
  });
}

const specCache = new Map<string, FullContractSpec>();

/** Look up a spec by symbol (trimmed, uppercased, `=F`/`=X` suffix stripped); unknown symbols are equities. */
export function getContractSpec(symbol: string): FullContractSpec {
  const key = String(symbol).trim().toUpperCase();
  let spec = specCache.get(key);
  if (!spec) {
    const canonical =
      key.endsWith('=F') || key.endsWith('=X') ? key.slice(0, -2) : key;
    spec =
      COMMON_SPECS[key] ??
      COMMON_SPECS[canonical] ??
      FullContractSpec.equity(key);
    specCache.set(key, spec);
  }
  return spec;
}
