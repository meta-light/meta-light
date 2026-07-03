import { RSSFeed } from '../../utils/rss'
import { SubstackAccount } from '../../utils/substack'
import { DEFAULT_OPENAI_OAUTH_MODEL } from '../../utils/ai/openai-oauth';

export const model = DEFAULT_OPENAI_OAUTH_MODEL;
export const TARGET_TOPICS = ['DePIN', 'Blockworks Research', 'Blockworks', 'Blockworks Data', 'Decentralized AI', 'Solana'];
export const USER_PROFILE = '0xMetaLight';
export const EMPLOYER_BRAND = 'Blockworks';
export const FOLLOWER_GOAL = 5000;
export const socialManagerConfig = {
  targetTopics: TARGET_TOPICS,
  tweetAnalysisLimit: 50,
  newsLookbackDays: 1,
  confidenceThreshold: 0.9,
  employerBrand: EMPLOYER_BRAND,
  followerGoal: FOLLOWER_GOAL
};
export interface IX_TRACKING { name: string; profile: string; type: 'project' | 'fund' | 'person' | 'news'; associatedAccounts?: string[]; }
export const HOURS_TO_ANALYZE = 24;
export const TWEETS_PER_PROFILE = 5;

export const X_TRACKING: IX_TRACKING[] = [
  { name: '375ai', profile: '375ai_', type: 'project', associatedAccounts: ['neilc_dawn'] },
  { name: 'DAWN', profile: 'dawninternet', type: 'project', associatedAccounts: [] },
  { name: 'Helium', profile: 'helium', type: 'project', associatedAccounts: ['ScottSigel', 'zer0tweets', 'abhay', 'amirhaleem', 'novalabs_'] },
  { name: 'Glow', profile: 'GlowFND', type: 'project', associatedAccounts: ['DavidVorick'] },
  { name: 'Grass', profile: 'grass', type: 'project', associatedAccounts: ['grassfdn'] },
  { name: 'Fogo', profile: 'FogoChain', type: 'project', associatedAccounts: [] },
  { name: 'Inference.Net', profile: 'inference_net', type: 'project', associatedAccounts: [] },
  { name: 'USDai', profile: 'USDai_Official', type: 'project', associatedAccounts: [] },
  { name: 'Daylight Energy', profile: 'daylightenergy_', type: 'project', associatedAccounts: ['jasonbadeaux'] },
  { name: 'Jito', profile: 'jito_sol', type: 'project', associatedAccounts: [] },
  { name: 'Pipe Network', profile: 'pipenetwork', type: 'project', associatedAccounts: [] },
  { name: 'DoubleZero', profile: 'doublezero', type: 'project', associatedAccounts: [] },
  { name: 'TapeDrive', profile: 'tapedrive_io', type: 'project', associatedAccounts: [] },
  { name: 'Hivemapper', profile: 'Hivemapper', type: 'project', associatedAccounts: ['aseidman'] },
  { name: 'EV3ventures', profile: 'EV3ventures', type: 'fund', associatedAccounts: ['MoneroMahesh', 'DAnconia_Crypto'] },
  { name: 'santiagoroel', profile: 'santiagoroel', type: 'person', associatedAccounts: [] },
  { name: 'Melt_Dem', profile: 'Melt_Dem', type: 'person', associatedAccounts: [] },
  { name: 'GEODNET', profile: 'GEODNET', type: 'project', associatedAccounts: ['mikeahorton'] },
  { name: 'WatcherGuru', profile: 'WatcherGuru', type: 'news', associatedAccounts: [] },
  { name: 'unusual_whales', profile: 'unusual_whales', type: 'news', associatedAccounts: [] },
  { name: 'FirstSquawk', profile: 'FirstSquawk', type: 'news', associatedAccounts: [] },
  { name: 'DegenerateNews', profile: 'DegenerateNews', type: 'news', associatedAccounts: [] },
  { name: 'tier10k', profile: 'tier10k', type: 'news', associatedAccounts: [] },
  { name: 'solidintel_x', profile: 'solidintel_x', type: 'news', associatedAccounts: [] },
  { name: 'dlnews', profile: 'dlnews', type: 'news', associatedAccounts: [] },
  { name: 'DegenerateNews', profile: 'DegenerateNews', type: 'news', associatedAccounts: [] },
  { name: 'WuBlockchain', profile: 'WuBlockchain', type: 'news', associatedAccounts: [] },
  // { name: '', profile: '', type: '', associatedAccounts: [] },
];

export const RSS_URLS: RSSFeed[] = [
  // { name: 'Messari', url: 'https://messari.io/rss' }, // 429 and Vercel Checkpoint issues
  { name: 'Crypto News', url: 'https://www.crypto-news.net/feed/', pagination: 'wordpress' },
  { name: 'Crypto Briefing', url: 'https://www.cryptobriefing.com/feed/', pagination: 'wordpress' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/feed' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed' },
  { name: 'CNBC Crypto', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { name: 'Crypto Breaking', url: 'https://www.cryptobreaking.com/feed/', pagination: 'wordpress' },
  { name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/', pagination: 'wordpress' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', pagination: 'wordpress' },
  { name: '99Bitcoins', url: 'https://99bitcoins.com/feed/', pagination: 'wordpress' },
  { name: 'Bitcoinist', url: 'http://Bitcoinist.com/feed', pagination: 'wordpress' },
  { name: 'ZyCrypto', url: 'https://zycrypto.com/feed/', pagination: 'wordpress' },
  { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', pagination: 'wordpress' },
  { name: 'CryptoNinjas', url: 'https://www.cryptoninjas.net/feed/', pagination: 'wordpress' },
  { name: 'Inside Bitcoins', url: 'http://insidebitcoins.com/feed', pagination: 'arc' },
  { name: 'Cryptocy News', url: 'https://www.cryptocynews.com/feed/', pagination: 'wordpress' },
  { name: 'The Bitcoin News', url: 'https://thebitcoinnews.com/feed/', pagination: 'wordpress' },
  { name: 'CoinJournal', url: 'https://coinjournal.net/feed/', pagination: 'wordpress' },
  { name: 'Live Bitcoin News', url: 'https://www.livebitcoinnews.com/feed/', pagination: 'wordpress' },
  { name: 'E-Crypto News', url: 'https://e-cryptonews.com/index.php/feed', pagination: 'wordpress' },
  { name: 'Bitcoin.com News', url: 'https://news.bitcoin.com/feed/', pagination: 'wordpress' },
  { name: 'Blockonomi', url: 'https://blockonomi.com/feed/', pagination: 'wordpress' },
]

export const SUBSTACK_ACCOUNTS: SubstackAccount[] = [
  { name: 'fundraise.fun', slug: 'fundraisedotfun', url: 'https://fundraisedotfun.substack.com', maxPosts: 50 },
];

export const TrackedSubstackAccounts = SUBSTACK_ACCOUNTS;

export const TELEGRAM_CHANNELS = ['crypto_fundraising', 'shoalresearch', 'ZoomerfiedNews', 'TreeNewsFeed', 'unfolded'];
