// Ported from backtester/execution/contract_spec.py (QuantJourney Backtester, Apache 2.0)
//
// Local subset of ContractSpec: only the fields and math the portfolio ledger
// needs. Kept here (not imported from engine/execution) so portfolio
// accounting has no dependency on the execution module. Any object carrying
// `multiplier` (such as the core ContractSpec) is accepted and filled with
// the Python defaults.

export type AssetClass = 'equity' | 'future' | 'fx' | 'crypto' | 'option';

/** Resolved contract economics used by the ledger. */
export interface PortfolioContractSpec {
  symbol: string;
  assetClass: AssetClass;
  /** 1 for equity/crypto, contract multiplier for futures. */
  multiplier: number;
  /** 100,000 for FX standard lots, 1 otherwise. */
  lotSize: number;
  /** Margin per contract or lot; 0 means full notional. */
  margin: number;
  /** Inverse (coin-margined) contract: notional = |q| * multiplier / price. */
  inverse: boolean;
  quoteCurrency: string;
}

/** What a resolver may return. Missing fields take the Python defaults. */
export interface ContractSpecInput {
  multiplier: number;
  symbol?: string;
  assetClass?: AssetClass;
  lotSize?: number;
  margin?: number;
  inverse?: boolean;
  quoteCurrency?: string;
}

export type ContractSpecResolver = (instrument: string) => ContractSpecInput;

function currencyCode(value: string, field: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code)) {
    throw new Error(
      `${field} must be a non-empty alphanumeric currency code, got ${value}`,
    );
  }
  return code;
}

/** Fill defaults and validate economic inputs (ContractSpec.__post_init__ subset). */
export function resolveContractSpec(
  instrument: string,
  input: ContractSpecInput,
): PortfolioContractSpec {
  const spec: PortfolioContractSpec = {
    symbol: input.symbol ?? instrument,
    assetClass: input.assetClass ?? 'equity',
    multiplier: input.multiplier,
    lotSize: input.lotSize ?? 1,
    margin: input.margin ?? 0,
    inverse: input.inverse ?? false,
    quoteCurrency: currencyCode(input.quoteCurrency ?? 'USD', 'quoteCurrency'),
  };
  if (!Number.isFinite(spec.multiplier) || spec.multiplier <= 0) {
    throw new Error(`${instrument}: multiplier must be finite and positive`);
  }
  if (!Number.isFinite(spec.lotSize) || spec.lotSize <= 0) {
    throw new Error(`${instrument}: lotSize must be finite and positive`);
  }
  if (!Number.isFinite(spec.margin) || spec.margin < 0) {
    throw new Error(`${instrument}: margin must be finite and non-negative`);
  }
  return spec;
}

/** FX contracts must settle in the portfolio currency (no FX conversion). */
export function validateSettlementCurrency(
  spec: PortfolioContractSpec,
  settlementCurrency: string,
): void {
  if (spec.assetClass !== 'fx') return;
  const settlement = currencyCode(settlementCurrency, 'settlementCurrency');
  if (spec.quoteCurrency !== settlement) {
    throw new Error(
      `FX contract ${spec.symbol} produces notional and PnL in ${spec.quoteCurrency}, ` +
        `but the portfolio settles in ${settlement}. Currency conversion is not implemented.`,
    );
  }
}

/** Absolute notional exposure of a position. */
export function notional(
  spec: PortfolioContractSpec,
  quantity: number,
  price: number,
): number {
  if (spec.inverse)
    return price !== 0 ? (Math.abs(quantity) * spec.multiplier) / price : 0;
  return Math.abs(quantity) * Math.abs(price) * spec.multiplier * spec.lotSize;
}

/** Collateral required: margin per unit when set, otherwise full notional. */
export function marginRequired(
  spec: PortfolioContractSpec,
  quantity: number,
  price: number,
): number {
  if (spec.margin > 0) return Math.abs(quantity) * spec.margin;
  return notional(spec, quantity, price);
}
