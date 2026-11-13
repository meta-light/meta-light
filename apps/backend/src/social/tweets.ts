import { inArray } from 'drizzle-orm';
import type { ITweet, TweetStore } from '@meta-light/utils/twitter-api';
import { connectDatabase, getDb } from '../database/client';
import { tweets } from './schema';

const EMPTY_METRICS: ITweet['metrics'] = {
  like_count: 0,
  retweet_count: 0,
  reply_count: 0,
  quote_count: 0,
  view_count: 0,
};

function engagementRate(metrics: ITweet['metrics']): number {
  const views = metrics.view_count || 0;
  if (views <= 0) return 0;
  const engagements =
    (metrics.like_count || 0) +
    (metrics.retweet_count || 0) +
    (metrics.reply_count || 0) +
    (metrics.quote_count || 0);
  return engagements / views;
}

export async function upsertTweets(
  inputs: Partial<ITweet>[],
): Promise<{ newTweets: number; updatedTweets: number }> {
  const rows = inputs.filter(
    (tweet): tweet is Partial<ITweet> & { id: string; text: string } =>
      Boolean(tweet.id && tweet.text),
  );
  if (rows.length === 0) return { newTweets: 0, updatedTweets: 0 };
  await connectDatabase();
  const ids = rows.map((row) => row.id);
  const existingIds = new Set<string>();
  // D1 caps bound parameters per query at 100.
  for (let offset = 0; offset < ids.length; offset += 80) {
    const existing = await getDb()
      .select({ id: tweets.id })
      .from(tweets)
      .where(inArray(tweets.id, ids.slice(offset, offset + 80)));
    for (const row of existing) existingIds.add(row.id);
  }
  let newTweets = 0;
  let updatedTweets = 0;
  for (const tweet of rows) {
    const metrics = tweet.metrics ?? EMPTY_METRICS;
    const performance: ITweet['performance'] = {
      engagement_rate: engagementRate(metrics),
      performance_score: tweet.performance?.performance_score ?? 0,
      viral_potential: tweet.performance?.viral_potential ?? 0,
      last_metrics_update: tweet.performance?.last_metrics_update ?? new Date(),
    };
    const fields = {
      text: tweet.text,
      createdAt: tweet.createdAt ?? new Date().toISOString(),
      lastUpdated: new Date(),
      isReply: tweet.isReply ?? false,
      inReplyToId: tweet.inReplyToId,
      inReplyToUsername: tweet.inReplyToUsername,
      conversationId: tweet.conversationId,
      metrics,
      urls: tweet.urls ?? [],
      media: tweet.media ?? [],
      author: tweet.author,
      analysis: tweet.analysis,
      performance,
      source: tweet.source,
      updatedAt: new Date(),
    };
    await getDb()
      .insert(tweets)
      .values({
        id: tweet.id,
        publishedAt: tweet.publishedAt ?? new Date(),
        ...fields,
      })
      .onConflictDoUpdate({ target: tweets.id, set: fields });
    if (existingIds.has(tweet.id)) updatedTweets += 1;
    else newTweets += 1;
  }
  return { newTweets, updatedTweets };
}

export const tweetStore: TweetStore = { upsertTweets };
