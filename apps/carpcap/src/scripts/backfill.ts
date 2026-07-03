#!/usr/bin/env tsx
import mongoose from 'mongoose';
import { MONGODB_URI, TWITTER_API_KEY } from '../env';
import { Tweets, ITweet } from '../utils/twitter/schema';
import { USER_PROFILE } from '../services/social/config';

interface TwitterApiResponse {tweets: any[]; has_next_page: boolean; next_cursor: string | null; success: boolean; error?: string;}

class TweetBackfiller {
  private readonly username = USER_PROFILE;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.twitterapi.io/twitter/tweet/advanced_search';
  private readonly requestDelay = 1000;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;

  constructor(apiKey: string) {this.apiKey = apiKey;}
  private async delay(ms: number): Promise<void> {return new Promise(resolve => setTimeout(resolve, ms));}

  private async searchTweets(cursor?: string): Promise<TwitterApiResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('query', `from:${this.username}`);
    url.searchParams.set('queryType', 'Latest');
    if (cursor) {url.searchParams.set('cursor', cursor);}
    const headers = {'x-api-key': this.apiKey, 'Content-Type': 'application/json'};
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`   API Request attempt ${attempt}/${this.maxRetries}`);
        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {const errorText = await response.text(); throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);}
        const data = await response.json();
        let tweets = data.tweets || data.data?.tweets || [];
        if (Array.isArray(data)) {tweets = data;}
        return {tweets, has_next_page: !!data.has_next_page, next_cursor: data.next_cursor || null, success: true};
      } 
      catch (error) {
        lastError = error as Error;
        console.log(`   Attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < this.maxRetries) {console.log(`   Retrying in ${this.retryDelay}ms...`); await this.delay(this.retryDelay);}
      }
    }
    return {tweets: [], has_next_page: false, next_cursor: null, success: false, error: lastError?.message || 'Unknown error'};
  }

  private processTweetData(rawTweet: any): Partial<ITweet> {
    const fullText = rawTweet.full_text || rawTweet.extended_tweet?.full_text || rawTweet.text || '';
    const hashtags = (fullText.match(/#[\w]+/g) || []).map((h: string) => h.substring(1));
    const mentions = (fullText.match(/@[\w]+/g) || []).map((m: string) => m.substring(1));
    const createdAt = rawTweet.createdAt || rawTweet.created_at || new Date().toISOString();
    return {
      id: rawTweet.id,
      text: fullText,
      createdAt,
      lastUpdated: new Date(),
      isReply: rawTweet.isReply || !!rawTweet.in_reply_to_status_id || !!rawTweet.inReplyToId,
      inReplyToId: rawTweet.inReplyToId || rawTweet.in_reply_to_status_id || undefined,
      inReplyToUsername: rawTweet.inReplyToUsername || rawTweet.in_reply_to_screen_name || undefined,
      conversationId: rawTweet.conversationId || rawTweet.conversation_id || rawTweet.id,
      metrics: {
        like_count: rawTweet.likeCount || rawTweet.favorite_count || 0,
        retweet_count: rawTweet.retweetCount || rawTweet.retweet_count || 0,
        reply_count: rawTweet.replyCount || rawTweet.reply_count || 0,
        quote_count: rawTweet.quoteCount || rawTweet.quote_count || 0,
        view_count: rawTweet.viewCount || rawTweet.view_count || rawTweet.views || 0
      },
      urls: rawTweet.entities?.urls?.map((u: any) => u.expanded_url || u.url) || [],
      media: (rawTweet.extendedEntities?.media || rawTweet.entities?.media || []).map((m: any) => ({
        type: m.type || 'photo',
        url: m.url || '',
        media_url: m.media_url_https || m.media_url || ''
      })),
      author: {
        id: rawTweet.author?.id || rawTweet.user?.id_str || rawTweet.author_id || '',
        username: rawTweet.author?.userName || rawTweet.user?.screen_name || this.username,
        name: rawTweet.author?.name || rawTweet.user?.name || 'Nick Carpinito',
        verified: rawTweet.author?.isVerified || rawTweet.user?.verified || false,
        followers_count: rawTweet.author?.followers || rawTweet.user?.followers_count || 0,
        following_count: rawTweet.author?.following || rawTweet.user?.friends_count || 0
      },
      analysis: {
        sentiment: 'neutral',
        topics: [],
        hashtags,
        mentions,
        language: rawTweet.lang || 'en',
        word_count: fullText.split(/\s+/).filter((w: string) => w.length > 0).length,
        character_count: fullText.length
      },
      performance: {engagement_rate: 0, performance_score: 0, viral_potential: 0, last_metrics_update: new Date()},
      source: {api: 'twitterapi.io', fetched_at: new Date(), processed: false, processing_errors: []}
    };
  }

  private async saveTweets(tweets: any[]): Promise<{ new: number; updated: number }> {
    if (tweets.length === 0) return { new: 0, updated: 0 };
    const bulkOps: any[] = [];
    for (const tweet of tweets) {
      try {
        const processedTweet = this.processTweetData(tweet);
        if (!processedTweet.source) processedTweet.source = {} as any;
        processedTweet.source!.fetched_at = processedTweet.source!.fetched_at || new Date();
        bulkOps.push({updateOne: {filter: { id: processedTweet.id }, update: { $set: processedTweet, $setOnInsert: { publishedAt: new Date() } }, upsert: true}});
      } 
      catch (error) {console.error(`   Failed to process tweet ${tweet.id}:`, error);}
    }
    if (bulkOps.length === 0) return { new: 0, updated: 0 };
    try {
      const bulkResult = await Tweets.collection.bulkWrite(bulkOps, { ordered: false });
      return {new: bulkResult.upsertedCount, updated: bulkResult.modifiedCount};
    } 
    catch (error) {console.error('   Database error:', error); return { new: 0, updated: 0 };}
  }

  async backfillAll(limit: number = Infinity): Promise<void> {
    const limitText = limit === Infinity ? 'ALL tweets' : `${limit} tweets`;
    console.log(`Starting backfill for @${this.username} (fetching: ${limitText})...\n`);
    let cursor: string | undefined = undefined;
    let pageNumber = 0;
    let totalTweets = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let hasMore = true;
    while (hasMore && totalTweets < limit) {
      pageNumber++;
      console.log(`Page ${pageNumber}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);
      const response = await this.searchTweets(cursor);
      if (!response.success || response.tweets.length === 0) {
        if (response.error) {console.log(`   Error: ${response.error}`);} 
        else {console.log('   No more tweets found');}
        break;
      }
      const tweetsToProcess = response.tweets.slice(0, limit - totalTweets);
      console.log(`   Got ${response.tweets.length} tweets (processing ${tweetsToProcess.length})`);
      totalTweets += tweetsToProcess.length;
      const result = await this.saveTweets(tweetsToProcess);
      totalNew += result.new;
      totalUpdated += result.updated;
      console.log(`   Saved: ${result.new} new, ${result.updated} updated`);
      console.log(`   Running total: ${totalTweets} fetched, ${totalNew} new, ${totalUpdated} updated\n`);
      if (totalTweets >= limit) {console.log(`   Reached limit of ${limit} tweets`); hasMore = false;}
      else if (!response.has_next_page || !response.next_cursor) {console.log('   Reached the end of available tweets'); hasMore = false;} 
      else {cursor = response.next_cursor; await this.delay(this.requestDelay);}
    }
    console.log('\n Backfill complete!');
    console.log('Final stats:');
    console.log(`   - Total tweets fetched: ${totalTweets}`);
    console.log(`   - New tweets saved: ${totalNew}`);
    console.log(`   - Existing tweets updated: ${totalUpdated}`);
    console.log(`   - Total pages processed: ${pageNumber}`);
  }
}

async function main() {
  console.log(`0xMetaLight Tweet Backfill Script (@${USER_PROFILE})\n`);
  const args = process.argv.slice(2);
  let limit = Infinity;
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
      if (isNaN(limit) || limit < 1) {console.error('Invalid limit value. Using default: ALL tweets'); limit = Infinity;}
    } 
    else if (arg === '--all') {
      limit = Infinity;
      console.log('Fetching ALL tweets (no limit)\n');
    } 
    else if (arg === '--help' || arg === '-h') {
      console.log(`
          Usage: npm run backfill:0xmetalight [-- --limit=N]

          Options:
            --limit=N    Limit to N tweets
            --all        Fetch all available tweets (default)
            --help, -h   Show this help message

          Examples:
            npm run backfill:0xmetalight                 # Fetch ALL tweets (default)
            npm run backfill:0xmetalight -- --limit=200 # Fetch only 200 tweets

          Note: The API returns ~20 tweets per page (this is fixed by Twitter API).
                The script will continue fetching pages until all tweets are retrieved.
      `);
      process.exit(0);
    }
  }

  try {
    if (!TWITTER_API_KEY) {throw new Error('TWITTER_API_KEY not set in environment');}
    if (!MONGODB_URI) {throw new Error('MONGODB_URI not set in environment');}
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    const backfiller = new TweetBackfiller(TWITTER_API_KEY);
    await backfiller.backfillAll(limit);
    console.log('\nDone!');
  } 
  catch (error) {console.error('\nError:', error); process.exit(1);} 
  finally {await mongoose.connection.close(); console.log('\n MongoDB connection closed');}
}

main();
