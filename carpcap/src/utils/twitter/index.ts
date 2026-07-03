import mongoose from 'mongoose';
import { Tweets, ITweet } from './schema';
import { MONGODB_URI, TWITTER_API_KEY } from '../../env';
import { USER_PROFILE } from '../../services/social/config';

interface RateLimitInfo {remaining: number; resetTime: number; retryAfter: number;}
interface TwitterApiResponse {tweets: any[]; has_next_page: boolean; next_cursor: string | null; success: boolean; error?: string;}

export interface FetchResult {
  success: boolean;
  totalFetched: number;
  newTweets: number;
  updatedTweets: number;
  errors: string[];
  lastTweetId?: string;
  oldestTweetDate?: string;
  newestTweetDate?: string;
}

export class TwitterApiService {
  private readonly baseUrl = 'https://api.twitterapi.io/twitter/user/last_tweets';
  private readonly advancedSearchUrl = 'https://api.twitterapi.io/twitter/tweet/advanced_search';
  private readonly username = USER_PROFILE;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;
  private readonly requestDelay = 1000;
  private readonly baseDelay = 1000;
  private readonly maxRequestsPerMinute = 60;
  private readonly breakerThreshold = parseInt(process.env.X_API_BREAKER_THRESHOLD || '3');
  private readonly breakerCooldownMs = parseInt(process.env.X_API_BREAKER_COOLDOWN_MS || '900000');
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitInfo: RateLimitInfo | null = null;
  private readonly requestWindow = 60000;
  private breakerOpenUntil: number | null = null;
  private serverErrorStreak: number = 0;
  constructor() {if (!TWITTER_API_KEY) {throw new Error('Twitter API key is required');}}

  private getAuthHeaders(): Record<string, string> {
    if (!TWITTER_API_KEY) {throw new Error('Twitter API key is required for Twitter Video Service');}
    return { 'x-api-key': TWITTER_API_KEY as string };
  }

  async getUserId(username: string): Promise<string | null> {
    try {
      const url = `https://api.twitterapi.io/twitter/user/by/username/${username}`;
      const headers = this.getAuthHeaders();
      const response = await fetch(url, { headers });
      if (!response.ok) {console.error(`Failed to lookup user: ${response.status} ${response.statusText}`); return null;}
      const data = await response.json();
      return data.id || null;
    } 
    catch (error) {console.error('Error looking up userId:', error); return null;}
  }

  async fetchLatestTweets(numTweets: number = 10): Promise<FetchResult> {
    try {
      await this.ensureDbConnection();
      const allTweets = await this.fetchTweetsWithPagination(this.username, numTweets);
      if (allTweets.length === 0) {console.log('   No tweets found from API'); return {success: true, totalFetched: 0, newTweets: 0, updatedTweets: 0, errors: []};}
      const result = await this.processTweets(allTweets);
      return result;
    } 
    catch (error) {
      console.error('   Twitter API fetch failed:', error);
      return {success: false, totalFetched: 0, newTweets: 0, updatedTweets: 0, errors: [error instanceof Error ? error.message : String(error)]};
    }
  }

  private async fetchTweetsWithPagination(userName: string, targetCount: number): Promise<any[]> {
    const allTweets: any[] = [];
    let cursor: string | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    while (allTweets.length < targetCount && attempts < maxAttempts) {
      attempts++;
      try {
        const response = await this.makeApiRequest(userName, cursor);
        if (!response.success || !response.tweets) {console.log(`API request failed: ${response.error}`); break;}
        allTweets.push(...response.tweets);
        if (!response.has_next_page || !response.next_cursor) {console.log('No more pages available'); break;}
        cursor = response.next_cursor;
        await this.delay(this.requestDelay);
      } 
      catch (error) {console.error(`Error in pagination attempt ${attempts}:`, error); break;}
    }
    const result = allTweets.slice(0, targetCount);
    return result;
  }

  private async makeApiRequest(userName: string, cursor?: string | null): Promise<TwitterApiResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('userName', userName);
    url.searchParams.set('includeReplies', 'false');
    if (cursor) {url.searchParams.set('cursor', cursor);}
    const headers = {'x-api-key': TWITTER_API_KEY as string, 'Content-Type': 'application/json'};
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`   Error response: ${errorText}`);
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        let tweets = data.tweets || data.data?.tweets || [];
        if (Array.isArray(data)) {tweets = data;}
        return {tweets, has_next_page: !!data.has_next_page, next_cursor: data.next_cursor || null, success: true};
      } 
      catch (error) {
        lastError = error as Error;
        console.log(`Attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < this.maxRetries) {console.log(`Retrying in ${this.retryDelay}ms...`); await this.delay(this.retryDelay);}
      }
    }
    return {tweets: [], has_next_page: false, next_cursor: null, success: false, error: lastError?.message || 'Unknown error'};
  }

  private async processTweets(tweets: any[]): Promise<FetchResult> {
    const result: FetchResult = {success: true, totalFetched: tweets.length, newTweets: 0, updatedTweets: 0, errors: []};
    const bulkOps: any[] = [];
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    console.log(`   Processing ${tweets.length} tweets for DB save...`);
    for (const tweet of tweets) {
      try {
        const processedTweet = this.processTweetData(tweet);
        const tweetDate = new Date(processedTweet.createdAt || new Date());
        if (!oldestDate || tweetDate < oldestDate) oldestDate = tweetDate;
        if (!newestDate || tweetDate > newestDate) newestDate = tweetDate;
        if (!processedTweet.source) processedTweet.source = {} as any;
        processedTweet.source!.fetched_at = processedTweet.source!.fetched_at || new Date();
        if (processedTweet.media && !Array.isArray(processedTweet.media)) {processedTweet.media = [];}
        const cleanedTweet = JSON.parse(JSON.stringify(processedTweet));
        bulkOps.push({
          updateOne: {
            filter: { id: cleanedTweet.id },
            update: { $set: cleanedTweet, $setOnInsert: { publishedAt: new Date() }},
            upsert: true
          }
        });
      } 
      catch (error) {
        const errorMsg = `Failed to process tweet ${tweet.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    const allIds = bulkOps.map((op: any) => op.updateOne.filter.id);
    const uniqueIds = new Set(allIds);
    if (allIds.length !== uniqueIds.size) {
      console.log(`   WARNING: Duplicate IDs detected! ${allIds.length} ops but only ${uniqueIds.size} unique IDs`);
      const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
      console.log(`       Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
    }
    if (bulkOps.length > 0) {
      bulkOps[0].updateOne.update.$set;
      try {
        const bulkResult = await Tweets.collection.bulkWrite(bulkOps, { ordered: false });
        result.newTweets = bulkResult.upsertedCount;
        result.updatedTweets = bulkResult.modifiedCount;
        const bulkResultAny = bulkResult as any;
        if (bulkResultAny.writeErrors && bulkResultAny.writeErrors.length > 0) {
          console.log(`    BulkWrite had ${bulkResultAny.writeErrors.length} write errors:`);
          bulkResultAny.writeErrors.slice(0, 3).forEach((err: any) => {
            console.log(`      Error: ${err.errmsg} | Code: ${err.code} | Index: ${err.index}`);
            if (err.index < bulkOps.length) {const failedId = bulkOps[err.index].updateOne.filter.id; console.log(`Failed tweet ID: ${failedId}`);}
          });
        }
        const discrepancy = bulkOps.length - bulkResult.matchedCount;
        if (discrepancy > 0) {console.log(`    WARNING: ${discrepancy} tweets were prepared but not matched/saved!`);}
        if (bulkResult.matchedCount > 0 && bulkResult.modifiedCount === 0 && bulkResult.upsertedCount === 0) {console.log(`${bulkResult.matchedCount} tweets already exist with identical data`);}
      } 
      catch (error) {
        const errorMsg = `Database bulk write failed: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        result.success = false;
        console.error('Database error details:', error);
      }
    }
    if (oldestDate) result.oldestTweetDate = oldestDate.toISOString();
    if (newestDate) result.newestTweetDate = newestDate.toISOString();
    if (tweets.length > 0) result.lastTweetId = tweets[0].id;
    return result;
  }

  private async ensureDbConnection(): Promise<void> {
    if (!mongoose.connection.readyState) {
      if (!MONGODB_URI) {throw new Error('MONGODB_URI not set');}
      console.log('Connecting to MongoDB...');
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected');
    }
  }

  private delay(ms: number): Promise<void> {return new Promise(resolve => setTimeout(resolve, ms));}

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
      media: Array.isArray(rawTweet.extendedEntities?.media) 
        ? rawTweet.extendedEntities.media.map((m: any) => ({type: m.type || 'photo', url: m.url || '', media_url: m.media_url_https || m.media_url || ''})) : Array.isArray(rawTweet.entities?.media)
        ? rawTweet.entities.media.map((m: any) => ({type: m.type || 'photo', url: m.url || '', media_url: m.media_url_https || m.media_url || ''})) : [],
      author: {
        id: rawTweet.author?.id || rawTweet.user?.id_str || rawTweet.author_id || '',
        username: rawTweet.author?.userName || rawTweet.user?.screen_name || this.username,
        name: rawTweet.author?.name || rawTweet.user?.name || USER_PROFILE,
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
      performance: {
        engagement_rate: 0,
        performance_score: 0,
        viral_potential: 0,
        last_metrics_update: new Date()
      },
      source: {
        api: 'twitterapi.io',
        fetched_at: new Date(),
        processed: false,
        processing_errors: []
      }
    };
  }

  async backfillAllTweets(batchSize: number = 200): Promise<FetchResult> {
    console.log(`🔄 Starting backfill of all tweets for ${this.username} (batch size: ${batchSize})...`);
    try {
      await this.ensureDbConnection();
      const aggregateResult: FetchResult = {success: true, totalFetched: 0, newTweets: 0, updatedTweets: 0, errors: []};
      let cursor: string | null = null;
      let batchNumber = 0;
      let hasMore = true;
      while (hasMore) {
        batchNumber++;
        console.log(`\n📦 Processing batch ${batchNumber}...`);
        try {
          const batchTweets: any[] = [];
          let attempts = 0;
          const maxAttemptsPerBatch = Math.ceil(batchSize / 20);
          while (batchTweets.length < batchSize && attempts < maxAttemptsPerBatch) {
            attempts++;
            const response = await this.makeApiRequest(this.username, cursor);
            if (!response.success || !response.tweets || response.tweets.length === 0) {console.log('No more tweets available or API error'); hasMore = false; break;}
            batchTweets.push(...response.tweets);
            if (!response.has_next_page || !response.next_cursor) {console.log('Reached end of available tweets'); hasMore = false; break;}
            cursor = response.next_cursor;
            await this.delay(this.requestDelay);
          }
          if (batchTweets.length === 0) {console.log('No tweets in this batch, stopping backfill'); break;}
          const batchResult = await this.processTweets(batchTweets.slice(0, batchSize));
          aggregateResult.totalFetched += batchResult.totalFetched;
          aggregateResult.newTweets += batchResult.newTweets;
          aggregateResult.updatedTweets += batchResult.updatedTweets;
          aggregateResult.errors.push(...batchResult.errors);
          if (batchResult.oldestTweetDate) {aggregateResult.oldestTweetDate = batchResult.oldestTweetDate;}
          if (!aggregateResult.newestTweetDate && batchResult.newestTweetDate) {aggregateResult.newestTweetDate = batchResult.newestTweetDate;}
          console.log(`Batch ${batchNumber} complete: ${batchResult.newTweets} new, ${batchResult.updatedTweets} updated`);
          console.log(`Running total: ${aggregateResult.totalFetched} tweets processed`);
          if (hasMore) {await this.delay(this.requestDelay * 2);}
        } 
        catch (error) {
          const errorMsg = `Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error('❌', errorMsg);
          aggregateResult.errors.push(errorMsg);
          await this.delay(this.retryDelay);
        }
      }
      console.log('\nBackfill completed!');
      console.log(`Final stats: ${aggregateResult.totalFetched} total tweets`);
      console.log(`   - ${aggregateResult.newTweets} new tweets added`);
      console.log(`   - ${aggregateResult.updatedTweets} tweets updated`);
      console.log(`   - ${aggregateResult.errors.length} errors`);
      if (aggregateResult.oldestTweetDate && aggregateResult.newestTweetDate) {
        console.log(`   - Date range: ${aggregateResult.oldestTweetDate} to ${aggregateResult.newestTweetDate}`);
      }
      return aggregateResult;
    } 
    catch (error) {
      console.error('Backfill failed:', error);
      return {
        success: false,
        totalFetched: 0,
        newTweets: 0,
        updatedTweets: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private calculateBackoffDelay(attempt: number): number {const exponentialDelay = this.baseDelay * Math.pow(2, attempt); const jitter = Math.random() * 1000; return Math.min(exponentialDelay + jitter, 30000);}
  private async wait(ms: number): Promise<void> {return new Promise(resolve => setTimeout(resolve, ms));}
  private canMakeRequest(): boolean {
    if (!this.rateLimitInfo) {return this.requestCount < this.maxRequestsPerMinute;}
    if (this.rateLimitInfo.remaining > 0) {return true;}
    if (Date.now() >= this.rateLimitInfo.resetTime) {this.rateLimitInfo = null; return true;}
    return false;
  }

  private updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetTime = response.headers.get('x-ratelimit-reset');
    const retryAfter = response.headers.get('retry-after');
    if (remaining !== null || resetTime !== null || retryAfter !== null) {this.rateLimitInfo = {remaining: remaining ? parseInt(remaining) : this.maxRequestsPerMinute, resetTime: resetTime ? parseInt(resetTime) * 1000 : Date.now() + this.requestWindow, retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 0};}
  }

  private async makeRateLimitedRequest(url: string, headers: HeadersInit, attempt: number = 0): Promise<Response> {
    if (this.breakerOpenUntil && Date.now() < this.breakerOpenUntil) {throw new Error('X API outage breaker open');}
    if (!this.canMakeRequest()) {const delay = this.rateLimitInfo?.retryAfter || this.calculateBackoffDelay(attempt); await this.wait(delay);}
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < 1000) {const delay = 1000 - timeSinceLastRequest; await this.wait(delay);}
    this.lastRequestTime = Date.now();
    this.requestCount++;
    const response = await fetch(url, { headers });
    this.updateRateLimitInfo(response);
    if (response.status === 429) {
      if (attempt < this.maxRetries) {
        const retryAfter = this.rateLimitInfo?.retryAfter || this.calculateBackoffDelay(attempt);
        console.log(`Rate limited (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${retryAfter}ms...`);
        await this.wait(retryAfter);
        return this.makeRateLimitedRequest(url, headers, attempt + 1);
      } 
      else {throw new Error(`Rate limited after ${this.maxRetries} attempts`);}
    }
    if (response.status >= 500 && response.status < 600) {
      this.serverErrorStreak++;
      if (this.serverErrorStreak >= this.breakerThreshold) {
        this.breakerOpenUntil = Date.now() + this.breakerCooldownMs;
        const until = new Date(this.breakerOpenUntil).toISOString();
        throw new Error(`X API outage threshold reached (breaker open until ${until})`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!response.ok) {if (response.status === 402) {console.warn('X API 402 (Payment Required). Skipping.');} throw new Error(`HTTP error! status: ${response.status}`);} 
    this.serverErrorStreak = 0;
    if (this.breakerOpenUntil && Date.now() >= this.breakerOpenUntil) {this.breakerOpenUntil = null;}
    return response;
  }

  private async fetchUserLastTweets(userId: string, includeReplies: boolean = false, cursor: string = ''): Promise<{ tweets: any[]; hasNextPage: boolean; nextCursor: string | null; success: boolean; error?: string; }> {
    try {
      const headers = this.getAuthHeaders();
      const base = 'https://api.twitterapi.io/twitter/user/last_tweets';
      const url = `${base}?userId=${encodeURIComponent(userId)}` + (includeReplies ? '&includeReplies=true' : '') + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const response = await this.makeRateLimitedRequest(url, headers);
      const data = await response.json();
      return { tweets: data.tweets || [], hasNextPage: !!data.has_next_page, nextCursor: data.next_cursor || null, success: true };
    } 
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching user last tweets for userId="${userId}": ${msg}`);
      return { tweets: [], hasNextPage: false, nextCursor: null, success: false, error: msg };
    }
  }

  public async searchTweetsRaw(query: string, queryType: 'Latest' | 'Top' = 'Latest', cursor?: string): Promise<{ tweets: any[]; hasNextPage: boolean; nextCursor: string | null; success: boolean; error?: string; }> {
    try {
      const url = `${this.advancedSearchUrl}?query=${encodeURIComponent(query)}&queryType=${queryType}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const headers = this.getAuthHeaders();
      const response = await this.makeRateLimitedRequest(url, headers);
      const data = await response.json();
      return { tweets: data.tweets || [], hasNextPage: !!data.has_next_page, nextCursor: data.next_cursor || null, success: true };
    } 
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error searching tweets with query="${query}": ${msg}`);
      return { tweets: [], hasNextPage: false, nextCursor: null, success: false, error: msg };
    }
  }
  
  public getRateLimitStatus(): {remaining: number; resetTime: Date | null; queueLength: number; isProcessing: boolean;} {
    return {
      remaining: this.rateLimitInfo?.remaining || this.maxRequestsPerMinute,
      resetTime: this.rateLimitInfo?.resetTime ? new Date(this.rateLimitInfo.resetTime) : null,
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  public resetRateLimitState(): void {this.requestCount = 0; this.rateLimitInfo = null; this.requestQueue = []; this.isProcessingQueue = false; this.lastRequestTime = 0;}

  public async fetchListMembers(listId: string, cursor?: string): Promise<{ members: any[]; hasNextPage: boolean; nextCursor: string | null; success: boolean; error?: string; }> {
    try {
      const headers = this.getAuthHeaders();
      const base = 'https://api.twitterapi.io/twitter/list/members';
      const url = `${base}?list_id=${encodeURIComponent(listId)}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const response = await this.makeRateLimitedRequest(url, headers);
      const data = await response.json();
      return { members: data.members || [], hasNextPage: !!data.has_next_page, nextCursor: data.next_cursor || null, success: true };
    } 
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching list members for list_id="${listId}": ${msg}`);
      return { members: [], hasNextPage: false, nextCursor: null, success: false, error: msg };
    }
  }

  public async fetchListTweets(listId: string, includeReplies: boolean = false): Promise<{ tweets: any[]; success: boolean; error?: string; }> {
    try {
      const membersResp = await this.fetchListMembers(listId);
      if (!membersResp.success) {return { tweets: [], success: false, error: membersResp.error || 'Failed to fetch list members' };}
      const members = membersResp.members || [];
      const allTweets: any[] = [];
      for (const member of members) {
        const userId = member?.id;
        if (!userId) continue;
        const { tweets, success } = await this.fetchUserLastTweets(String(userId), includeReplies);
        if (success && Array.isArray(tweets)) {allTweets.push(...tweets);} 
      }
      const getCreatedAt = (t: any): string | null => t?.createdAt || t?.created_at || null;
      allTweets.sort((a, b) => {const ta = getCreatedAt(a); const tb = getCreatedAt(b); const da = ta ? new Date(ta).getTime() : 0; const db = tb ? new Date(tb).getTime() : 0; return db - da;});
      return { tweets: allTweets, success: true };
    } 
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching list tweets for list_id="${listId}": ${msg}`);
      return { tweets: [], success: false, error: msg };
    }
  }
}

export async function fetchLatestTweets(numTweets: number = 20): Promise<FetchResult> {const service = new TwitterApiService(); return await service.fetchLatestTweets(numTweets);}
export async function backfillAllTweets(batchSize: number = 200): Promise<FetchResult> {const service = new TwitterApiService(); return await service.backfillAllTweets(batchSize);}