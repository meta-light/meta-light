import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getTweets } from './simple-nitter';

const TARGET_ACCOUNTS = [
  'dawninternet',
  'helium',
  'GlowFND',
  'grass',
  'FogoChain',
  'daylightenergy_',
  'jito_sol',
  'pipenetwork',
  'DoubleZero',
  'TapeDrive_io',
  'Hivemapper',
  'GEODNET',
  'EV3ventures',
  'santiagoroel',
  'Melt_Dem',
  'WatcherGuru',
  'unusual_whales',
  'FirstSquawk',
  'DegenerateNews',
  'tier10k',
  'solidintel_x',
];

function parseRelativeDate(value: string): Date | null {
  const match = /^(\d+)\s*([smhd])/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const now = Date.now();
  const unit = match[2];
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60_000
        : unit === 'h'
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(now - ms);
}

async function main() {
  const username = process.argv[2];
  const hoursAgo = Number(process.argv[3] || 24);
  const maxTweets = Number(process.argv[4] || 20);
  if (!username) {
    console.log('Usage: bun src/scripts/nitter-monitor.ts [username] [hours_ago] [max_tweets]');
    process.exit(1);
  }
  const accounts = [username, ...TARGET_ACCOUNTS.filter((account) => account !== username)].slice(0, 3);
  const cutoff = Date.now() - hoursAgo * 3_600_000;
  const results: Record<string, unknown[]> = {};
  for (const account of accounts) {
    const fetched = await getTweets(account, maxTweets);
    if (!('tweets' in fetched)) continue;
    results[account] = fetched.tweets.filter((tweet) => {
      const parsed = parseRelativeDate(tweet.date) || new Date(tweet.date);
      return Number.isNaN(parsed.getTime()) || parsed.getTime() > cutoff;
    });
  }
  const workspace =
    process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace');
  const output = path.join(workspace, 'data', `tweets_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
  console.log(`Saved ${Object.values(results).reduce((sum, tweets) => sum + tweets.length, 0)} tweets to ${output}`);
}

await main();
