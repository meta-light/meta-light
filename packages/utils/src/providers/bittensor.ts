type TaoWallet = {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
};

function wallets<T>(name: string): T[] {
  const raw = process.env[name];
  if (!raw) return [];
  return JSON.parse(raw) as T[];
}

export const TAO_WALLETS = wallets<TaoWallet>('PORTFOLIO_TAO_WALLETS');
export const TAO_DECIMALS = 9;
export const ALPHA_DECIMALS = 9;
export const TAO_API_BASE = 'https://api.taostats.io/api';

export type WalletConfig = {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
};

export type SnapshotWallet = {
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

export type Snapshot = {
  createdAt: string;
  wallets: SnapshotWallet[];
  failures: Array<{ wallet: WalletConfig; reason: string }>;
  totals: { taoUsd: number; alphaUsd: number; totalUsd: number };
};

type TaoStatsListResponse<T> = { data: T[] };
type TaoPriceResponse = { price: string };
type PoolResponse = { price: string };

type AccountResponse = {
  timestamp: string;
  balance_free: string;
  alpha_balances: Array<{
    balance: string;
    balance_as_tao: string;
    netuid: number;
  }>;
};

async function getApiKey(): Promise<string> {
  if (process.env.TAOSTATS_API_KEY) return process.env.TAOSTATS_API_KEY;
  throw new Error('TAOSTATS_API_KEY missing in environment variables.');
}

function fromUnits(value: string | number, decimals: number): number {
  return Number(value) / 10 ** decimals;
}

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
  const alphaBalance =
    current.alphaBalance - (previous?.alphaBalance ?? current.alphaBalance);
  return {
    taoBalance:
      current.taoBalance - (previous?.taoBalance ?? current.taoBalance),
    alphaBalance,
    earnedAlphaUsdAtCurrentPrice: alphaBalance * current.alphaPriceUsd,
  };
}

async function fetchJson<T>(
  apiKey: string,
  pathname: string,
  search: Record<string, string>,
): Promise<T> {
  const url = new URL(`${TAO_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(search))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Taostats request failed for ${url}: ${response.status} ${body}`,
    );
  }
  return (await response.json()) as T;
}

async function buildWalletSnapshot(
  wallet: WalletConfig,
  apiKey: string,
  taoPriceUsd: number,
): Promise<SnapshotWallet> {
  const [accountResp, poolResp] = await Promise.all([
    fetchJson<TaoStatsListResponse<AccountResponse>>(
      apiKey,
      '/account/latest/v1',
      { address: wallet.address },
    ),
    fetchJson<TaoStatsListResponse<PoolResponse>>(
      apiKey,
      '/dtao/pool/latest/v1',
      { netuid: String(wallet.netuid) },
    ),
  ]);
  const account = accountResp.data[0];
  if (!account) {
    throw new Error(`No account data returned for ${wallet.name}`);
  }

  const alphaEntry = account.alpha_balances.find(
    (entry) => entry.netuid === wallet.netuid,
  );
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
    totalUsd: taoUsd + alphaUsd,
  } satisfies SnapshotWallet;
}

/** Defaults to PORTFOLIO_TAO_WALLETS. */
export async function buildTaoSnapshot(
  walletsConfig: WalletConfig[] = TAO_WALLETS,
): Promise<Snapshot> {
  const apiKey = await getApiKey();
  const taoPriceResponse = await fetchJson<
    TaoStatsListResponse<TaoPriceResponse>
  >(apiKey, '/price/latest/v1', { asset: 'tao' });
  const taoPriceUsd = Number(taoPriceResponse.data[0]?.price ?? 0);
  const walletResults = await Promise.allSettled(
    walletsConfig.map((wallet) =>
      buildWalletSnapshot(wallet, apiKey, taoPriceUsd),
    ),
  );
  const wallets = walletResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const failures = walletResults.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          {
            wallet: walletsConfig[index],
            reason:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          },
        ]
      : [],
  );

  if (wallets.length === 0) {
    const reason = failures
      .map(
        (failure) =>
          `SN${failure.wallet.netuid} ${failure.wallet.name}: ${failure.reason}`,
      )
      .join('; ');
    throw new Error(`Unable to build TAO snapshot for any wallet. ${reason}`);
  }

  const totals = wallets.reduce(
    (acc, wallet) => {
      acc.taoUsd += wallet.taoUsd;
      acc.alphaUsd += wallet.alphaUsd;
      acc.totalUsd += wallet.totalUsd;
      return acc;
    },
    { taoUsd: 0, alphaUsd: 0, totalUsd: 0 },
  );
  return { createdAt: new Date().toISOString(), wallets, failures, totals };
}

/** Telegram HTML report; pass the previous snapshot to show 24h alpha earned. */
export function renderTaoReport(snapshot: Snapshot, previous?: Snapshot): string {
  const previousMap = new Map(
    previous?.wallets.map((wallet) => [walletKey(wallet), wallet]) ?? [],
  );
  const intro = `<b>Bittensor daily balance update — ${snapshot.createdAt}</b>`;
  const sections = snapshot.wallets.map((wallet) => {
    const delta = findDelta(wallet, previousMap.get(walletKey(wallet)));
    return [
      `<b>SN${wallet.netuid} — ${wallet.subnetName}</b>`,
      `- TAO Balance: <code>${wallet.taoBalance.toFixed(6)}</code> ($${wallet.taoUsd.toFixed(2)})`,
      `- Alpha Balance: <code>${wallet.alphaBalance.toFixed(9)}</code> ($${wallet.alphaUsd.toFixed(2)})`,
      `- Alpha as TAO: <code>${wallet.alphaAsTao.toFixed(6)}</code>`,
      `- Alpha Earned (24h): <code>${amount(delta.alphaBalance, 9)}</code> ($${delta.earnedAlphaUsdAtCurrentPrice.toFixed(2)})`,
    ].join('\n');
  });
  const summary = [
    `<b>Tracked wallets:</b> ${snapshot.wallets.length}`,
    `<b>Total tracked USD:</b> $${snapshot.totals.totalUsd.toFixed(2)}`,
  ].join('\n');
  const failures =
    snapshot.failures.length > 0
      ? [
          '<b>Wallets with fetch errors</b>',
          ...snapshot.failures.map(
            (failure) =>
              `- SN${failure.wallet.netuid} — ${failure.wallet.name}: <code>${escapeHtml(failure.reason)}</code>`,
          ),
        ]
      : [];
  return [intro, '', ...sections, '', summary, '', ...failures]
    .filter(Boolean)
    .join('\n');
}
