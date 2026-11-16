export type AssetClass = 'equity' | 'future' | 'fx' | 'crypto' | 'option';

export interface PortfolioContractSpec {
  symbol: string;
  assetClass: AssetClass;
  multiplier: number;
  lotSize: number;
  margin: number;
  inverse: boolean;
  quoteCurrency: string;
}

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

export function notional(
  spec: PortfolioContractSpec,
  quantity: number,
  price: number,
): number {
  if (spec.inverse)
    return price !== 0 ? (Math.abs(quantity) * spec.multiplier) / price : 0;
  return Math.abs(quantity) * Math.abs(price) * spec.multiplier * spec.lotSize;
}

export function marginRequired(
  spec: PortfolioContractSpec,
  quantity: number,
  price: number,
): number {
  if (spec.margin > 0) return Math.abs(quantity) * spec.margin;
  return notional(spec, quantity, price);
}
