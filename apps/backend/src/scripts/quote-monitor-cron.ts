import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { main as githubMonitor } from './github-monitor';

loadEnv({ path: path.resolve(import.meta.dirname, '../../.env') });

const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace');
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const CONFIG_PATH =
  process.env.TWITTER_ACCOUNTS_CONFIG || path.join(WORKSPACE_DIR, 'config', 'twitter-accounts.json');
const NITTER_SCRAPER =
  process.env.NITTER_SCRAPER || path.join(import.meta.dirname, 'nitter-browser-scraper.ts');

if (!TAVILY_API_KEY) {
  console.error('Missing TAVILY_API_KEY — set it in apps/backend/.env');
  process.exit(1);
}

type Signal = {
  type: string;
  text?: string;
  owner?: string;
  repo?: string;
  query?: string;
  account?: string;
  tweet?: { text: string; date?: string; url?: string };
  url?: string;
  date?: string;
  files?: Array<{ name?: string }>;
  results?: unknown[];
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseDate(dateStr: string): Date | null {
  const now = new Date();
  const shortFormat = /^([A-Za-z]{3})\s+(\d{1,2})$/i.exec(dateStr.trim());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (shortFormat) {
    const monthIndex = months.findIndex((month) => month.toLowerCase() === shortFormat[1].toLowerCase());
    if (monthIndex !== -1) {
      const date = new Date(now.getFullYear(), monthIndex, Number(shortFormat[2]));
      if (date > now) date.setFullYear(now.getFullYear() - 1);
      return date;
    }
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTweetRecent(dateStr?: string) {
  if (!dateStr) return false;
  if (dateStr.includes('h')) {
    const hours = Number(dateStr.match(/(\d+)h/)?.[1] || 0);
    return hours >= 2 && hours <= 48;
  }
  if (dateStr.includes('m')) return false;
  if (dateStr.includes('d')) {
    const days = Number(dateStr.match(/(\d+)d/)?.[1] || 0);
    return days >= 0 && days <= 2;
  }
  const tweetDate = parseDate(dateStr);
  if (!tweetDate) return false;
  const diffHours = (Date.now() - tweetDate.getTime()) / 3_600_000;
  return diffHours >= 2 && diffHours <= 48;
}

function isQuoteWorthy(text: string) {
  if (text.length < 20) return false;
  return ![/get rich quick/i, /limited time.*discount/i, /click here.*now/i, /dm me for/i, /send.*to.*wallet/i, /buy.*token.*now/i, /guaranteed.*returns/i].some(
    (pattern) => pattern.test(text),
  );
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { all_accounts?: string[] };
  const allSignals: Signal[] = [];
  try {
    const githubResults = await githubMonitor();
    allSignals.push(...(githubResults.filter(Boolean) as Signal[]));
  } catch (error) {
    console.error('  GitHub monitoring failed:', message(error));
  }
  try {
    const query = 'DePIN crypto infrastructure network effects';
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 10,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { results?: unknown[] };
      if (data.results?.length) allSignals.push({ type: 'tavily', query, results: data.results });
    }
  } catch (error) {
    console.error('  Tavily search failed:', message(error));
  }
  for (const username of (config.all_accounts || []).sort(() => 0.5 - Math.random()).slice(0, 10)) {
    try {
      const output = execSync(`bun ${JSON.stringify(NITTER_SCRAPER)} user ${username} 3 --silent`, {
        encoding: 'utf8',
        timeout: 30000,
      });
      const data = JSON.parse(output) as { tweets?: Array<{ text: string; date?: string; url?: string }> };
      const tweet = data.tweets?.[0];
      if (!tweet || !isTweetRecent(tweet.date) || !isQuoteWorthy(tweet.text)) continue;
      allSignals.push({
        type: 'nitter',
        account: username,
        tweet,
        url: tweet.url,
        text: tweet.text,
        date: tweet.date,
      });
    } catch (error) {
      console.error(`    Error: ${message(error)}`);
    }
  }
  console.log(`Total signals found: ${allSignals.length}`);
}

await main();
