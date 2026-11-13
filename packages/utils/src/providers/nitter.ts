import puppeteer, { type Browser } from 'puppeteer';
import { load } from 'cheerio';

const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.net',
  'https://nitter.fdn.fr',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
  'https://nitter.moomoo.me',
  'https://nitter.it',
  'https://nitter.privacydev.net',
];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function getTweets(username: string, maxTweets = 10) {
  for (const instance of NITTER_INSTANCES) {
    try {
      const response = await fetch(`${instance}/${username}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const $ = load(await response.text());
      const tweets: Array<{ text: string; date: string; url: string }> = [];
      $('.timeline-item').each((_, item) => {
        if (tweets.length >= maxTweets) return;
        const text = $(item).find('.tweet-content').text().trim();
        if (!text) return;
        let url = $(item).find('a.tweet-link').attr('href') || '';
        if (url && !url.startsWith('http')) url = `https://x.com${url.replace('#m', '')}`;
        tweets.push({
          text,
          date: $(item).find('.tweet-date').text().trim(),
          url,
        });
      });
      if (tweets.length) return { instance, tweets };
    } catch {
      continue;
    }
  }
  return { error: 'Failed to fetch tweets from all instances' };
}

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
