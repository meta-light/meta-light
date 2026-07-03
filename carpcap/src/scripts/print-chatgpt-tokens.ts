/**
 * Run this ONCE on your local machine to print the values you need to set
 * as Railway environment variables:
 *
 *   npx tsx src/scripts/print-chatgpt-tokens.ts
 *
 * Copy the output into your Railway dashboard under:
 *   Settings → Variables
 *
 * Remote deployments should only persist the refresh token. Short-lived access,
 * id, and account tokens can go stale and trigger invalid workspace/account errors.
 */
import { readLocalAuthToken } from '../utils/ai/openai-oauth';

(async () => {
  const tokens = await readLocalAuthToken();
  if (!tokens.refresh_token) {console.error('No refresh_token found. Make sure you have run `npx @openai/codex login` first.'); process.exit(1);}
  console.log('\nFound tokens. Add these to Railway:\n');
  console.log(`CHATGPT_REFRESH_TOKEN=${tokens.refresh_token}`);
})();
