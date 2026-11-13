import { eq } from 'drizzle-orm';
import type {
  ScrapedTweetInput,
  ScrapedTweetStore,
} from '@meta-light/utils/scraping';
import { connectDatabase, getDb } from '../database/client';
import { scrapedTweets } from './schema';

export const scrapedTweetStore: ScrapedTweetStore = {
  async findScrapedTweet(id) {
    await connectDatabase();
    const [row] = await getDb()
      .select({ id: scrapedTweets.id })
      .from(scrapedTweets)
      .where(eq(scrapedTweets.id, id))
      .limit(1);
    return row ?? null;
  },

  async insertScrapedTweet(tweet: ScrapedTweetInput) {
    await connectDatabase();
    await getDb()
      .insert(scrapedTweets)
      .values({
        id: tweet.id,
        tweet: tweet.tweet,
        createdAt: tweet.created_at,
        metrics: tweet.metrics,
        permalink: tweet.permalink,
        quotedTweet: tweet.quotedTweet,
        screenName: tweet.screenName,
        scrapedAt: tweet.scrapedAt ?? new Date(),
      });
  },

  async updateScrapedTweetMetrics(id, metrics, quotedTweet, scrapedAt) {
    await connectDatabase();
    await getDb()
      .update(scrapedTweets)
      .set({ metrics, quotedTweet, scrapedAt })
      .where(eq(scrapedTweets.id, id));
  },
};
