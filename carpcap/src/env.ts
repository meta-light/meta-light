import dotenv from 'dotenv';
dotenv.config();
export const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT;
export const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
export const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
export const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
export const ALLOWED_CHANNEL_ID = process.env.DISCORD_ALLOWED_CHANNEL_ID;
export const HELIUS_KEY = process.env.HELIUS_KEY; 
export const MONGODB_URI = process.env.MONGODB_URI;
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
export const FLUXBEAM_API_KEY = process.env.FLUXBEAM_KEY;
export const XAI_BEARER_TOKEN = process.env.XAI_BEARER_TOKEN;
export const NEWS_API_ORG_KEY = process.env.NEWS_API_ORG_KEY;
export const CRYPTO_PANIC_KEY = process.env.CRYPTO_PANIC_KEY;
export const FINANCIAL_MODEL_PREP_KEY = process.env.FINANCIAL_MODEL_PREP_KEY;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
export const TELEGRAM_USE_BOT_CHAT = process.env.TELEGRAM_USE_BOT_CHAT;
export const RENTALS_LOCATION_ALLOWLIST = process.env.RENTALS_LOCATION_ALLOWLIST;
export const RENTALS_LOCATION_BLOCKLIST = process.env.RENTALS_LOCATION_BLOCKLIST;
export const RENTALS_NOTIFICATION_LOOKBACK_HOURS = process.env.RENTALS_NOTIFICATION_LOOKBACK_HOURS;
export const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const TOKENKEG_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const NODE_ENV = process.env.NODE_ENV;
export const ENABLE_TRADING = process.env.ENABLE_TRADING;
export const SOLANA_RPCS = [
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
  'https://api.mainnet-beta.solana.com',
  `https://eu.rpc.fluxbeam.xyz/?key=${FLUXBEAM_API_KEY}`
];
export const ECLIPSE_RPCS = ['https://eclipse.helius-rpc.com'];
export const POSTGRES_URI = process.env.POSTGRES_URI!;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const SUBSTACK_TOKEN = process.env.SUBSTACK_TOKEN!;
export const CHATGPT_REFRESH_TOKEN = process.env.CHATGPT_REFRESH_TOKEN!;
