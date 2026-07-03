import { runTaoPortfolio, seedWallets } from './bittensor';
import { runSolanaPortfolio } from './solana';

export { seedWallets };

export async function runPortfolioTask() {
  try { await runTaoPortfolio(); } catch(e) {console.error('Portfolio: TAO error', e);}
  try { await runSolanaPortfolio(); } catch(e) {console.error('Portfolio: Solana error', e);}
}