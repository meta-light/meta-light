import { PortfolioWallet, PortfolioState } from './model';
import { telegramBot } from '../../utils/telegram';
import mongoose from 'mongoose';
import { MONGODB_URI } from '../../env';
import { TAO_WALLETS, TAO_API_BASE, TAO_DECIMALS, ALPHA_DECIMALS } from './config';

const STATE_KEY = 'bittensor';

type WalletConfig = {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
};

type SnapshotWallet = {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
  timestamp: string;
  taoPriceUsd: number;
  alphaPriceTao: number;
  alphaPriceUsd: number;
  taoBalance: number;
  taoUsd: number;
  alphaBalance: number;
  alphaAsTao: number;
  alphaUsd: number;
  totalUsd: number;
};

type Snapshot = {
  createdAt: string;
  wallets: SnapshotWallet[];
  failures: Array<{ wallet: WalletConfig; reason: string }>;
  totals: {taoUsd: number; alphaUsd: number; totalUsd: number;};
};

type TaoStatsListResponse<T> = {data: T[];};
type TaoPriceResponse = {price: string;};
type PoolResponse = {price: string;};

type AccountResponse = {
  timestamp: string;
  balance_free: string;
  alpha_balances: Array<{balance: string; balance_as_tao: string; netuid: number;}>;
};

export async function seedWallets() {
  if (!MONGODB_URI) {throw new Error('MONGODB_URI not set');}
  try {
    await mongoose.connect(MONGODB_URI);
    for (const wallet of TAO_WALLETS) {
      await PortfolioWallet.findOneAndUpdate(
        { address: wallet.address, netuid: wallet.netuid },
        wallet,
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Error seeding wallets:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

async function getApiKey(): Promise<string> {
  if (process.env.TAOSTATS_API_KEY) return process.env.TAOSTATS_API_KEY;
  throw new Error('TAOSTATS_API_KEY missing in environment variables.');
}

async function readState(): Promise<{ lastSnapshot?: Snapshot }> {
  const stateDoc = await PortfolioState.findOne({ key: STATE_KEY });
  if (stateDoc && stateDoc.lastSnapshot) {return { lastSnapshot: stateDoc.lastSnapshot };}
  return {};
}

async function writeState(state: { lastSnapshot?: Snapshot }): Promise<void> {
  let stateDoc = await PortfolioState.findOne({ key: STATE_KEY });
  if (!stateDoc) {stateDoc = new PortfolioState({ key: STATE_KEY });}
  stateDoc.lastSnapshot = state.lastSnapshot;
  await stateDoc.save();
}

function fromUnits(value: string | number, decimals: number): number {return Number(value) / 10 ** decimals;}

function amount(value: number, digits = 6): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

function walletKey(wallet: Pick<WalletConfig, 'address' | 'netuid'>): string {
  return `${wallet.address}:${wallet.netuid}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function findDelta(current: SnapshotWallet, previous?: SnapshotWallet) {
  const alphaBalance = current.alphaBalance - (previous?.alphaBalance ?? current.alphaBalance);
  return {
    taoBalance: current.taoBalance - (previous?.taoBalance ?? current.taoBalance),
    alphaBalance,
    earnedAlphaUsdAtCurrentPrice: alphaBalance * current.alphaPriceUsd
  };
}

async function fetchJson<T>(apiKey: string, pathname: string, search: Record<string, string>): Promise<T> {
  const url = new URL(`${TAO_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  const response = await fetch(url, {headers: {Authorization: apiKey, Accept: 'application/json'}});
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Taostats request failed for ${url}: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function loadWalletConfigs(): Promise<WalletConfig[]> {
  const wallets = await PortfolioWallet.find({}, { _id: 0, __v: 0 }).lean<WalletConfig[]>();
  if (wallets.length > 0) {return wallets;}
  console.warn('No wallets configured in PortfolioWallet collection, falling back to src/services/portfolio/config.ts');
  return TAO_WALLETS;
}

async function buildWalletSnapshot(wallet: WalletConfig, apiKey: string, taoPriceUsd: number): Promise<SnapshotWallet> {
  const [accountResp, poolResp] = await Promise.all([
    fetchJson<TaoStatsListResponse<AccountResponse>>(apiKey, '/account/latest/v1', { address: wallet.address }),
    fetchJson<TaoStatsListResponse<PoolResponse>>(apiKey, '/dtao/pool/latest/v1', { netuid: String(wallet.netuid) })
  ]);
  const account = accountResp.data[0];
  if (!account) {throw new Error(`No account data returned for ${wallet.name}`);}

  const alphaEntry = account.alpha_balances.find((entry) => entry.netuid === wallet.netuid);
  const alphaPriceTao = Number(poolResp.data[0]?.price ?? 0);
  const taoBalance = fromUnits(account.balance_free, TAO_DECIMALS);
  const alphaBalance = fromUnits(alphaEntry?.balance ?? 0, ALPHA_DECIMALS);
  const alphaAsTao = fromUnits(alphaEntry?.balance_as_tao ?? 0, TAO_DECIMALS);
  const alphaPriceUsd = alphaPriceTao * taoPriceUsd;
  const taoUsd = taoBalance * taoPriceUsd;
  const alphaUsd = alphaBalance * alphaPriceUsd;

  return {
    name: wallet.name,
    address: wallet.address,
    netuid: wallet.netuid,
    subnetName: wallet.subnetName,
    timestamp: account.timestamp,
    taoPriceUsd,
    alphaPriceTao,
    alphaPriceUsd,
    taoBalance,
    taoUsd,
    alphaBalance,
    alphaAsTao,
    alphaUsd,
    totalUsd: taoUsd + alphaUsd
  } satisfies SnapshotWallet;
}

async function buildSnapshot(): Promise<Snapshot> {
  const apiKey = await getApiKey();
  const walletsConfig = await loadWalletConfigs();
  const taoPriceResponse = await fetchJson<TaoStatsListResponse<TaoPriceResponse>>(apiKey, '/price/latest/v1', { asset: 'tao' });
  const taoPriceUsd = Number(taoPriceResponse.data[0]?.price ?? 0);
  const walletResults = await Promise.allSettled(
    walletsConfig.map((wallet) => buildWalletSnapshot(wallet, apiKey, taoPriceUsd))
  );
  const wallets = walletResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const failures = walletResults.flatMap((result, index) => (
    result.status === 'rejected'
      ? [{ wallet: walletsConfig[index], reason: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
      : []
  ));

  if (wallets.length === 0) {
    const reason = failures.map((failure) => `SN${failure.wallet.netuid} ${failure.wallet.name}: ${failure.reason}`).join('; ');
    throw new Error(`Unable to build TAO snapshot for any wallet. ${reason}`);
  }

  const totals = wallets.reduce(
    (acc, wallet) => {
      acc.taoUsd += wallet.taoUsd;
      acc.alphaUsd += wallet.alphaUsd;
      acc.totalUsd += wallet.totalUsd;
      return acc;
    },
    { taoUsd: 0, alphaUsd: 0, totalUsd: 0 }
  );
  return {createdAt: new Date().toISOString(), wallets, failures, totals};
}

function renderReport(snapshot: Snapshot, previous?: Snapshot): string {
  const previousMap = new Map(previous?.wallets.map((wallet) => [walletKey(wallet), wallet]) ?? []);
  const intro = `<b>Bittensor daily balance update — ${snapshot.createdAt}</b>`;
  const sections = snapshot.wallets.map((wallet) => {
    const delta = findDelta(wallet, previousMap.get(walletKey(wallet)));
    return [
      `<b>SN${wallet.netuid} — ${wallet.subnetName}</b>`,
      `- TAO Balance: <code>${wallet.taoBalance.toFixed(6)}</code> ($${wallet.taoUsd.toFixed(2)})`,
      `- Alpha Balance: <code>${wallet.alphaBalance.toFixed(9)}</code> ($${wallet.alphaUsd.toFixed(2)})`,
      `- Alpha as TAO: <code>${wallet.alphaAsTao.toFixed(6)}</code>`,
      `- Alpha Earned (24h): <code>${amount(delta.alphaBalance, 9)}</code> ($${delta.earnedAlphaUsdAtCurrentPrice.toFixed(2)})`
    ].join('\n');
  });
  const summary = [
    `<b>Tracked wallets:</b> ${snapshot.wallets.length}`,
    `<b>Total tracked USD:</b> $${snapshot.totals.totalUsd.toFixed(2)}`
  ].join('\n');
  const failures = snapshot.failures.length > 0
    ? [
      '<b>Wallets with fetch errors</b>',
      ...snapshot.failures.map((failure) => `- SN${failure.wallet.netuid} — ${failure.wallet.name}: <code>${escapeHtml(failure.reason)}</code>`)
    ]
    : [];
  return [intro, '', ...sections, '', summary, '', ...failures].filter(Boolean).join('\n');
}

export async function runTaoPortfolio() {
  try {
    const snapshot = await buildSnapshot();
    const state = await readState();
    const report = renderReport(snapshot, state.lastSnapshot);
    await writeState({ lastSnapshot: snapshot });
    console.log(report);
    await telegramBot.sendMessage({text: report, parse_mode: 'HTML'});
  } catch (err) {
    console.error('Error running portfolio task:', err);
  }
}
