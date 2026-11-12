import { load } from 'cheerio';
import { pathToFileURL } from 'node:url';

const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.moomoo.me',
  'https://nitter.it',
  'https://nitter.privacydev.net',
  'https://nitter.net',
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const username = process.argv[2] || 'Helium';
  const count = Number(process.argv[3] || 10);
  console.log(JSON.stringify(await getTweets(username, count), null, 2));
}
