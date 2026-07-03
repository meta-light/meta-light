import dotenv from "dotenv";
dotenv.config();

export const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
if (!HELIUS_API_KEY) {throw new Error('HELIUS_API_KEY is not set');}
export const UNDERDOG_API_KEY = process.env.NEXT_PUBLIC_UNDERDOG_API_KEY;
if (!UNDERDOG_API_KEY) {throw new Error('UNDERDOG_API_KEY is not set');}
export const OMDB_API_KEY = process.env.NEXT_PUBLIC_OMDB_API_KEY;
if (!OMDB_API_KEY) {throw new Error('OMDB_API_KEY is not set');}
export const terminalCSS = 'https://unpkg.com/terminal.css@0.7.2/dist/terminal.min.css';
export const XAI_BEARER_TOKEN = process.env.XAI_BEARER_TOKEN;
// if (!XAI_BEARER_TOKEN) {throw new Error('XAI_BEARER_TOKEN is not set');}
export const NEWS_API_ORG_KEY = process.env.NEWS_API_ORG_KEY;
// if (!NEWS_API_ORG_KEY) {throw new Error('NEWS_API_ORG_KEY is not set');}
export const CRYPTO_PANIC_KEY = process.env.CRYPTO_PANIC_KEY;
// if (!CRYPTO_PANIC_KEY) {throw new Error('CRYPTO_PANIC_KEY is not set');}
export const FINANCIAL_MODEL_PREP_KEY = process.env.FINANCIAL_MODEL_PREP_KEY;
// if (!FINANCIAL_MODEL_PREP_KEY) {throw new Error('FINANCIAL_MODEL_PREP_KEY is not set');}