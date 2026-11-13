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

export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
export const FLUXBEAM_API_KEY =
  process.env.FLUXBEAM_API_KEY || process.env.FLUXBEAM_KEY;
export const XAI_BEARER_TOKEN = process.env.XAI_BEARER_TOKEN;
export const FINANCIAL_MODEL_PREP_KEY = process.env.FINANCIAL_MODEL_PREP_KEY;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
export const TELEGRAM_USE_BOT_CHAT = process.env.TELEGRAM_USE_BOT_CHAT;
export const NODE_ENV = process.env.NODE_ENV;
export const ENABLE_TRADING = process.env.ENABLE_TRADING;
export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
export const CLOUDFLARE_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;
export const CLOUDFLARE_D1_TOKEN = process.env.CLOUDFLARE_D1_TOKEN;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const SUBSTACK_TOKEN = process.env.SUBSTACK_TOKEN!;
export const CHATGPT_REFRESH_TOKEN = process.env.CHATGPT_REFRESH_TOKEN!;

export function enabled(flag: string): boolean {
  return process.env[flag] === 'true';
}
