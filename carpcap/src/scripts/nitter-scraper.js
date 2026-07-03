#!/usr/bin/env node

const puppeteer = require('puppeteer-core');

// List of nitter instances to try (in order)
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
];

async function getTrendingTweets() {
  let browser = null;
  let workingInstance = null;

  try {
    // Find a working nitter instance
    console.log('Finding working nitter instance...');

    for (const instance of NITTER_INSTANCES) {
      try {
        console.log(`Trying ${instance}...`);

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

        // Try to access trending page
        await page.goto(`${instance}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        const title = await page.title();
        if (title && !title.includes('Error')) {
          workingInstance = instance;
          console.log(`Found working instance: ${instance}`);
          break;
        }

        await browser.close();
        browser = null;
      } catch (e) {
        if (browser) {
          await browser.close();
          browser = null;
        }
        console.log(`${instance} failed: ${e.message}`);
      }
    }

    if (!browser || !workingInstance) {
      throw new Error('No working nitter instance found');
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Go to trending
    await page.goto(`${workingInstance}/trending`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait a bit for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract tweet content
    const tweets = await page.evaluate(() => {
      const tweetElements = document.querySelectorAll('.timeline-item');
      const results = [];

      for (const el of tweetElements) {
        try {
          const textEl = el.querySelector('.tweet-content');
          const nameEl = el.querySelector('.fullname');
          const usernameEl = el.querySelector('.username');
          const statsEl = el.querySelector('.tweet-stats');

          if (textEl && nameEl) {
            results.push({
              name: nameEl.textContent.trim(),
              username: usernameEl?.textContent.trim() || '',
              text: textEl.textContent.trim(),
            });
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
      tweets: tweets.slice(0, 10), // Return top 10
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

async function getUserTweets(username, count = 10) {
  let browser = null;
  let workingInstance = null;

  try {
    for (const instance of NITTER_INSTANCES) {
      try {
        browser = await puppeteer.launch({
          executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
          defaultViewport: { width: 1280, height: 800 },
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(`${instance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        const title = await page.title();
        if (title && !title.includes('Error')) {
          workingInstance = instance;
          break;
        }

        await browser.close();
        browser = null;
      } catch (e) {
        if (browser) {
          await browser.close();
          browser = null;
        }
      }
    }

    if (!browser || !workingInstance) {
      throw new Error('No working nitter instance found');
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(`${workingInstance}/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const tweets = await page.evaluate(() => {
      const tweetElements = document.querySelectorAll('.timeline-item');
      const results = [];

      for (const el of tweetElements) {
        try {
          const textEl = el.querySelector('.tweet-content');
          const dateEl = el.querySelector('.tweet-date');
          const statsEl = el.querySelector('.tweet-stats');

          if (textEl) {
            results.push({
              text: textEl.textContent.trim(),
              date: dateEl?.textContent.trim() || '',
            });
          }
        } catch (e) {}
      }

      return results;
    });

    await browser.close();

    return {
      instance: workingInstance,
      tweets: tweets.slice(0, count),
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

if (command === 'trending') {
  getTrendingTweets()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else if (command === 'user' && arg) {
  const count = parseInt(process.argv[4]) || 10;
  getUserTweets(arg, count)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
} else {
  console.log('Usage: node nitter-scraper.js <trending|user> [username] [count]');
  process.exit(1);
}
