import { eq } from 'drizzle-orm';
import { connectDatabase, getDb } from '../database/client';
import { scrapedTweets } from './schema';

export interface ScrapedTweetInput {
  id: string;
  tweet?: string;
  created_at?: string;
  metrics?: unknown;
  permalink?: string;
  quotedTweet?: unknown;
  screenName?: string;
  scrapedAt?: Date;
}

export async function findScrapedTweet(
  id: string,
): Promise<{ id: string } | null> {
  await connectDatabase();
  const [row] = await getDb()
    .select({ id: scrapedTweets.id })
    .from(scrapedTweets)
    .where(eq(scrapedTweets.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertScrapedTweet(
  tweet: ScrapedTweetInput,
): Promise<void> {
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
}

export async function updateScrapedTweetMetrics(
  id: string,
  metrics: unknown,
  quotedTweet: unknown,
  scrapedAt: Date,
): Promise<void> {
  await connectDatabase();
  await getDb()
    .update(scrapedTweets)
    .set({ metrics, quotedTweet, scrapedAt })
    .where(eq(scrapedTweets.id, id));
}
