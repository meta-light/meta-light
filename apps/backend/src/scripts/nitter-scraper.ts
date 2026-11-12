import puppeteer, { type Browser } from 'puppeteer';

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function launch() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
    defaultViewport: { width: 1280, height: 800 },
  });
}

async function findInstance(pathName: string) {
  let browser: Browser | null = null;
  for (const instance of NITTER_INSTANCES) {
    try {
      browser = await launch();
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.goto(`${instance}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const title = await page.title();
      if (title && !title.includes('Error')) return { browser, instance };
      await browser.close();
      browser = null;
    } catch {
      if (browser) await browser.close();
      browser = null;
    }
  }
  throw new Error('No working nitter instance found');
}

async function readTweets(page: Awaited<ReturnType<Browser['newPage']>>) {
  return page.evaluate(() => {
    const results: Array<{ name?: string; username?: string; text: string; date?: string }> = [];
    for (const el of document.querySelectorAll('.timeline-item')) {
      const text = el.querySelector('.tweet-content')?.textContent?.trim();
      if (!text) continue;
      results.push({
        name: el.querySelector('.fullname')?.textContent?.trim(),
        username: el.querySelector('.username')?.textContent?.trim(),
        text,
        date: el.querySelector('.tweet-date')?.textContent?.trim(),
      });
    }
    return results;
  });
}

export async function getTrendingTweets() {
  const found = await findInstance('');
  const page = await found.browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.goto(`${found.instance}/trending`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const tweets = (await readTweets(page)).slice(0, 10);
  await found.browser.close();
  return { instance: found.instance, tweets };
}

export async function getUserTweets(username: string, count = 10) {
  const found = await findInstance(`/${username}`);
  const page = await found.browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.goto(`${found.instance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const tweets = (await readTweets(page)).slice(0, count);
  await found.browser.close();
  return { instance: found.instance, tweets };
}

const command = process.argv[2];
const arg = process.argv[3];
if (command === 'trending') {
  getTrendingTweets()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (command === 'user' && arg) {
  getUserTweets(arg, Number(process.argv[4] || 10))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (process.argv[1]?.endsWith('nitter-scraper.ts')) {
  console.log('Usage: bun src/scripts/nitter-scraper.ts <trending|user> [username] [count]');
  process.exit(1);
}
