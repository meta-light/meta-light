#!/usr/bin/env node

const puppeteer = require('puppeteer-core');

// Nitter instances to try (in order of preference)
const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.net',
  'https://nitter.fdn.fr',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
];

// Target accounts to monitor
const TARGET_ACCOUNTS = [
  'Helium',
  'dawninternet',
  'GlowFND',
  'GEODNET',
  'DoubleZero',
  'FogoChain',
];

async function getTweetsFromAccount(username, maxTweets = 20, silent = false) {
  let browser = null;
  let workingInstance = null;

  const log = silent ? () => {} : console.log;

  try {
    log(`Fetching tweets from @${username}...`);

    // Find a working nitter instance
    for (const instance of NITTER_INSTANCES) {
      try {
        log(`  Trying ${instance}...`);

        browser = await puppeteer.launch({
          executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
          ],
          defaultViewport: { width: 1280, height: 800 },
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Try to access user's tweets
        await page.goto(`${instance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        const title = await page.title();
        if (title && !title.includes('Error') && !title.includes('Instance')) {
          workingInstance = instance;
          log(`  Found working instance: ${instance}`);
          break;
        }

        await browser.close();
        browser = null;
      } catch (e) {
        if (browser) {
          await browser.close();
          browser = null;
        }
        log(`  ${instance} failed: ${e.message}`);
      }
    }

    if (!browser || !workingInstance) {
      throw new Error('No working nitter instance found');
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(`${workingInstance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract tweet content
    const tweets = await page.evaluate(() => {
      const tweetElements = document.querySelectorAll('.timeline-item');
      const results = [];

      for (const el of tweetElements) {
        try {
          const textEl = el.querySelector('.tweet-content');
          const dateEl = el.querySelector('.tweet-date');
          const statsEl = el.querySelector('.tweet-stats');
          const linkEl = el.querySelector('.tweet-link');

          if (textEl) {
            const tweet = {
              text: textEl.textContent.trim(),
              date: dateEl?.textContent.trim() || '',
            };

            if (linkEl) {
              const href = linkEl.getAttribute('href');
              if (href) {
                tweet.url = href.startsWith('http') ? href : `https://x.com${href.replace('#m', '')}`;
              }
            }

            results.push(tweet);
          }
        } catch (e) {
          // Skip malformed tweets
        }
      }

      return results;
    });

    await browser.close();

    return {
      instance: workingInstance,
      tweets: tweets.slice(0, maxTweets),
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

// CLI interface
const command = process.argv[2];
const arg = process.argv[3];

if (command === 'user' && arg) {
  const count = parseInt(process.argv[4]) || 10;
  // Check for silent flag
  const silent = process.argv.includes('--silent');
  
  getTweetsFromAccount(arg, count, silent)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else if (command === 'accounts' || command === 'scan') {
  // Scan multiple accounts
  const silent = process.argv.includes('--silent');
  
  const promises = TARGET_ACCOUNTS.slice(0, 3).map(account =>
    getTweetsFromAccount(account, 5, silent)
      .then(result => ({ account, ...result }))
      .catch(err => ({ account, error: err.message }))
  );

  Promise.all(promises)
    .then(results => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else {
  console.log('Usage: node nitter-browser-scraper.js <user|scan> [username] [count] [--silent]');
  console.log('  Example: node nitter-browser-scraper.js user Helium 10');
  console.log('  Example: node nitter-browser-scraper.js user Helium 10 --silent');
  console.log('  Example: node nitter-browser-scraper.js scan');
  process.exit(1);
}
