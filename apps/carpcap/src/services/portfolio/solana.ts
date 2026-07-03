import { PortfolioState } from './model';
import { telegramBot } from '../../utils/telegram';
import { SOLANA_WALLETS } from './config';

const STATE_KEY = 'solana';
const JUPITER_PORTFOLIO_API_KEY = process.env.X_API_KEY;

type HoldingsAccount = { uiAmount?: number; excludeFromNetWorth?: boolean; };
type HoldingsResponse = { uiAmount?: number; tokens?: Record<string, HoldingsAccount[]>; };
type PnlWindow = { totalPnl?: number; totalPercentage?: number;};
type PnlWalletStats = { total?: { netWorth?: number; }; '1d'?: PnlWindow; };

type PnlWalletResponse = {
  stats?: PnlWalletStats;
  totalSolBalance?: number;
  totalUsdcBalance?: number;
  totalAssetsInPositions?: number;
};

type PnlResponse = Record<string, PnlWalletResponse>;

type SnapshotWallet = {
  name: string;
  address: string;
  tokenCount: number;
  openPositions: number;
  positionsFetched: boolean;
  netWorthUsd: number;
  oneDayPnlUsd: number;
  oneDayPnlPct: number;
  solBalance: number;
  usdcBalance: number;
};

type Snapshot = {
  createdAt: string;
  wallets: SnapshotWallet[];
  totals: {
    netWorthUsd: number;
    oneDayPnlUsd: number;
    solBalance: number;
    usdcBalance: number;
    tokenCount: number;
    openPositions: number;
  };
};

function signed(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

async function readState(): Promise<{ lastSnapshot?: Snapshot }> {
  const stateDoc = await PortfolioState.findOne({ key: STATE_KEY });
  if (stateDoc?.lastSnapshot) {return { lastSnapshot: stateDoc.lastSnapshot as Snapshot };}
  return {};
}

async function writeState(state: { lastSnapshot?: Snapshot }): Promise<void> {
  let stateDoc = await PortfolioState.findOne({ key: STATE_KEY });
  if (!stateDoc) {stateDoc = new PortfolioState({ key: STATE_KEY });}
  stateDoc.lastSnapshot = state.lastSnapshot;
  await stateDoc.save();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter request failed for ${url}: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function fetchWalletPNL(address: string): Promise<PnlWalletResponse> {
  const response = await fetchJson<PnlResponse>(`https://datapi.jup.ag/v1/pnl-stats?address=${address}`, { method: 'GET' });
  const wallet = response[address];
  if (!wallet) {throw new Error(`No pnl payload returned for ${address}`);}
  return wallet;
}

async function fetchWalletHoldings(address: string): Promise<HoldingsResponse> {
  return fetchJson<HoldingsResponse>(`https://ultra-api.jup.ag/holdings/${address}`, { method: 'GET' });
}

function countPositions(payload: unknown): number | null {
  if (Array.isArray(payload)) {return payload.length;}
  if (!payload || typeof payload !== 'object') {return null;}
  const maybeRecord = payload as Record<string, unknown>;
  if (Array.isArray(maybeRecord.data)) {return maybeRecord.data.length;}
  if (Array.isArray(maybeRecord.positions)) {return maybeRecord.positions.length;}
  return null;
}

async function fetchWalletPositions(address: string): Promise<number | null> {
  try {
    const headers = JUPITER_PORTFOLIO_API_KEY ? { 'x-api-key': JUPITER_PORTFOLIO_API_KEY } : undefined;
    const payload = await fetchJson<unknown>(`https://api.jup.ag/portfolio/v1/positions/${address}`, {method: 'GET', headers});
    return countPositions(payload);
  } catch (e) {
    console.warn(`Portfolio: Error fetching positions for ${address}`, e);
    return null;
  }
}

function countPositiveTokens(holdings: HoldingsResponse): number {
  return Object.values(holdings.tokens ?? {}).reduce((count, tokenAccounts) => {
    const totalUiAmount = tokenAccounts.reduce((sum, tokenAccount) => {
      if (tokenAccount.excludeFromNetWorth) {return sum;}
      return sum + (tokenAccount.uiAmount ?? 0);
    }, 0);
    return count + (totalUiAmount > 0 ? 1 : 0);
  }, 0);
}

function findDelta(current: SnapshotWallet, previous?: SnapshotWallet) {
  return {netWorthUsd: current.netWorthUsd - (previous?.netWorthUsd ?? current.netWorthUsd)};
}

async function buildSnapshot(): Promise<Snapshot> {
  const wallets = await Promise.all(
    SOLANA_WALLETS.map(async (wallet) => {
      const [pnl, holdings, positions] = await Promise.all([
        fetchWalletPNL(wallet.address),
        fetchWalletHoldings(wallet.address),
        fetchWalletPositions(wallet.address)
      ]);
      const statsTotal = pnl.stats?.total;
      const stats1d = pnl.stats?.['1d'];
      const openPositions = positions ?? pnl.totalAssetsInPositions ?? 0;
      return {
        name: wallet.name,
        address: wallet.address,
        tokenCount: countPositiveTokens(holdings),
        openPositions,
        positionsFetched: positions !== null,
        netWorthUsd: statsTotal?.netWorth ?? 0,
        oneDayPnlUsd: stats1d?.totalPnl ?? 0,
        oneDayPnlPct: stats1d?.totalPercentage ?? 0,
        solBalance: holdings.uiAmount ?? pnl.totalSolBalance ?? 0,
        usdcBalance: pnl.totalUsdcBalance ?? 0
      } satisfies SnapshotWallet;
    })
  );

  const totals = wallets.reduce(
    (acc, wallet) => {
      acc.netWorthUsd += wallet.netWorthUsd;
      acc.oneDayPnlUsd += wallet.oneDayPnlUsd;
      acc.solBalance += wallet.solBalance;
      acc.usdcBalance += wallet.usdcBalance;
      acc.tokenCount += wallet.tokenCount;
      acc.openPositions += wallet.openPositions;
      return acc;
    },
    { netWorthUsd: 0, oneDayPnlUsd: 0, solBalance: 0, usdcBalance: 0, tokenCount: 0, openPositions: 0 }
  );
  return {createdAt: new Date().toISOString(), wallets, totals};
}

function renderReport(snapshot: Snapshot, previous?: Snapshot): string {
  const previousMap = new Map(previous?.wallets.map((wallet) => [wallet.address, wallet]) ?? []);
  const intro = `<b>Solana daily balance update — ${snapshot.createdAt}</b>`;
  const sections = snapshot.wallets.map((wallet) => {
    const delta = findDelta(wallet, previousMap.get(wallet.address));
    const positionsLabel = wallet.positionsFetched ? `${wallet.openPositions} pos` : `${wallet.openPositions} pos*`;
    return [
      `<b>${wallet.name}</b>`,
      `- NW: <code>$${wallet.netWorthUsd.toFixed(2)}</code> (${signed(delta.netWorthUsd)})`,
      `- 1d PnL: <code>${signed(wallet.oneDayPnlUsd)}</code> (${signed(wallet.oneDayPnlPct)}%)`,
      `- Balances: <code>${wallet.solBalance.toFixed(3)} SOL</code> | <code>$${wallet.usdcBalance.toFixed(2)} USDC</code>`,
      `- Exposure: <code>${wallet.tokenCount} tokens</code> | <code>${positionsLabel}</code>`
    ].join('\n');
  });
  const summary = [
    `<b>Total tracked USD:</b> $${snapshot.totals.netWorthUsd.toFixed(2)}`,
    `<b>Total 1d PnL:</b> ${signed(snapshot.totals.oneDayPnlUsd)}`,
    `<b>Aggregate liquid balances:</b> ${snapshot.totals.solBalance.toFixed(3)} SOL + $${snapshot.totals.usdcBalance.toFixed(2)} USDC`
  ].join('\n');
  const footnote = snapshot.wallets.some((wallet) => !wallet.positionsFetched)
    ? '\n\n<i>* Positions count fell back to pnl stats because the dedicated positions endpoint was unavailable.</i>'
    : '';
  return [intro, '', ...sections, '', summary, footnote].filter(Boolean).join('\n');
}

export async function runSolanaPortfolio() {
  try {
    const snapshot = await buildSnapshot();
    const state = await readState();
    const report = renderReport(snapshot, state.lastSnapshot);
    await writeState({ lastSnapshot: snapshot });
    console.log(report);
    await telegramBot.sendMessage({ text: report, parse_mode: 'HTML' });
  } catch (e) {
    console.error('Portfolio: Error running Solana task', e);
  }
}
