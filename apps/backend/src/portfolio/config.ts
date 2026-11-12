export const TAO_DECIMALS = 9;
export const ALPHA_DECIMALS = 9;
export const TAO_API_BASE = 'https://api.taostats.io/api';

type TaoWallet = {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
};
type SolanaWallet = { name: string; address: string };

function wallets<T>(name: string): T[] {
  const raw = process.env[name];
  if (!raw) return [];
  return JSON.parse(raw) as T[];
}

export const TAO_WALLETS = wallets<TaoWallet>('PORTFOLIO_TAO_WALLETS');
export const SOLANA_WALLETS = wallets<SolanaWallet>('PORTFOLIO_SOLANA_WALLETS');
