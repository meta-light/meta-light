import puppeteer, { type Browser } from 'puppeteer';

const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.net',
  'https://nitter.fdn.fr',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
];

const TARGET_ACCOUNTS = ['Helium', 'dawninternet', 'GlowFND', 'GEODNET', 'DoubleZero', 'FogoChain'];
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function getTweetsFromAccount(username: string, maxTweets = 20, silent = false) {
  const log = silent ? () => undefined : console.log;
  let browser: Browser | null = null;
  let workingInstance: string | null = null;
  try {
    for (const instance of NITTER_INSTANCES) {
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
          defaultViewport: { width: 1280, height: 800 },
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(`${instance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const title = await page.title();
        if (title && !title.includes('Error') && !title.includes('Instance')) {
          workingInstance = instance;
          log(`Found working instance: ${instance}`);
          break;
        }
        await browser.close();
        browser = null;
      } catch (error) {
        if (browser) await browser.close();
        browser = null;
        log(`${instance} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (!browser || !workingInstance) throw new Error('No working nitter instance found');
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(`${workingInstance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const tweets = await page.evaluate(() =>
      [...document.querySelectorAll('.timeline-item')].flatMap((el) => {
        const text = el.querySelector('.tweet-content')?.textContent?.trim();
        if (!text) return [];
        const href = el.querySelector('.tweet-link')?.getAttribute('href') || '';
        return [
          {
            text,
            date: el.querySelector('.tweet-date')?.textContent?.trim() || '',
            url: href ? (href.startsWith('http') ? href : `https://x.com${href.replace('#m', '')}`) : undefined,
          },
        ];
      }),
    );
    await browser.close();
    return { instance: workingInstance, tweets: tweets.slice(0, maxTweets) };
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

const command = process.argv[2];
const arg = process.argv[3];
const silent = process.argv.includes('--silent');
if (command === 'user' && arg) {
  getTweetsFromAccount(arg, Number(process.argv[4] || 10), silent)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (command === 'accounts' || command === 'scan') {
  Promise.all(
    TARGET_ACCOUNTS.slice(0, 3).map((account) =>
      getTweetsFromAccount(account, 5, silent)
        .then((result) => ({ account, ...result }))
        .catch((error: Error) => ({ account, error: error.message })),
    ),
  )
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (process.argv[1]?.endsWith('nitter-browser-scraper.ts')) {
  console.log('Usage: bun src/scripts/nitter-browser-scraper.ts <user|scan> [username] [count] [--silent]');
  process.exit(1);
}
