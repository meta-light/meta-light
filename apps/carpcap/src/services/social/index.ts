import { queryOpenAIOAuth } from '../../utils/ai/openai-oauth';
import { fetchAllTelegramChannelsPaginated, telegramBot } from '../../utils/telegram';
import { fetchRSSFeedPaginated } from '../../utils/rss';
import { fetchSubstackFeed } from '../../utils/substack';
import { GP, searchPrompt, SP, VP } from './prompts';
import { GeneratedTweet, PerformanceAnalysis, VerificationResult } from './interface';
import { Tweets, ITweet } from '../../utils/twitter/schema';
import {
  EMPLOYER_BRAND,
  FOLLOWER_GOAL,
  RSS_URLS,
  TELEGRAM_CHANNELS,
  TrackedSubstackAccounts,
  USER_PROFILE,
  X_TRACKING,
  model
} from './config';

type ContextSignal = {
  source: string;
  title: string;
  link: string;
  publishedAt: Date;
  summary: string;
};

export class SocialManagerV2 {
  private readonly lookbackHours = 4;
  private readonly fallbackContextHours = 24;
  private readonly maxExternalSignals = 20;
  private readonly maxExternalContextChars = 5000;
  private readonly maxRssFeeds = 10;

  private getFocusedHandles(limit = 10): string[] {
    const handles = X_TRACKING.map((h) => h.profile).filter(Boolean);
    const unique = [...new Set(handles)];
    return unique.slice(0, limit);
  }

  private parseDateSafe(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  }

  private normalizeText(value: unknown, maxLength = 260): string {
    if (typeof value !== 'string') {
      return '';
    }
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return '';
    }
    if (compact.length <= maxLength) {
      return compact;
    }
    return `${compact.slice(0, maxLength - 3)}...`;
  }

  private isWithinHours(date: Date, hours: number): boolean {
    const now = Date.now();
    const ageMs = now - date.getTime();
    return ageMs >= 0 && ageMs <= hours * 60 * 60 * 1000;
  }

  private extractHostname(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private getAllowedDomains(): string[] {
    const baseDomains = ['x.com', 'twitter.com', 't.me', 'substack.com'];
    const rssDomains = RSS_URLS.map((feed) => this.extractHostname(feed.url)).filter(
      (host): host is string => Boolean(host)
    );
    const substackDomains = TrackedSubstackAccounts.map((account) => account.url?.trim())
      .filter((url): url is string => Boolean(url))
      .map((url) => this.extractHostname(url))
      .filter((host): host is string => Boolean(host));
    const unique = [...new Set([...baseDomains, ...rssDomains, ...substackDomains])];
    return unique.slice(0, 25);
  }

  private mapRawSignals(rawSignals: unknown[], fallbackSource: string): ContextSignal[] {
    const mapped: ContextSignal[] = [];
    for (const raw of rawSignals) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const item = raw as Record<string, unknown>;
      const title = this.normalizeText(item.title ?? item.description ?? item.content, 180);
      const link = this.normalizeText(item.link, 300);
      const publishedAt = this.parseDateSafe(item.pubDate);
      if (!title || !link || !publishedAt) {
        continue;
      }
      mapped.push({
        source: this.normalizeText(item.feedName, 80) || fallbackSource,
        title,
        link,
        publishedAt,
        summary: this.normalizeText(item.description ?? item.content ?? title, 260)
      });
    }
    return mapped;
  }

  private async gatherExternalSignals(): Promise<ContextSignal[]> {
    const telegramPromise = TELEGRAM_CHANNELS.length
      ? fetchAllTelegramChannelsPaginated(TELEGRAM_CHANNELS, 1)
          .then((items) => this.mapRawSignals(items, 'Telegram'))
          .catch((error) => {
            console.error('Error fetching Telegram context:', error);
            return [] as ContextSignal[];
          })
      : Promise.resolve([] as ContextSignal[]);

    const rssFeeds = RSS_URLS.slice(0, this.maxRssFeeds);
    const rssPromise = rssFeeds.length
      ? Promise.all(rssFeeds.map((feed) => fetchRSSFeedPaginated(feed, 1)))
          .then((grouped) => this.mapRawSignals(grouped.flat(), 'RSS'))
          .catch((error) => {
            console.error('Error fetching RSS context:', error);
            return [] as ContextSignal[];
          })
      : Promise.resolve([] as ContextSignal[]);

    const substackPromise = TrackedSubstackAccounts.length
      ? Promise.all(TrackedSubstackAccounts.map((account) => fetchSubstackFeed(account, 5)))
          .then((grouped) => this.mapRawSignals(grouped.flat(), 'Substack'))
          .catch((error) => {
            console.error('Error fetching Substack context:', error);
            return [] as ContextSignal[];
          })
      : Promise.resolve([] as ContextSignal[]);

    const [telegramSignals, rssSignals, substackSignals] = await Promise.all([
      telegramPromise,
      rssPromise,
      substackPromise
    ]);

    const allSignals = [...telegramSignals, ...rssSignals, ...substackSignals].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );
    const inPrimaryWindow = allSignals.filter((signal) => this.isWithinHours(signal.publishedAt, this.lookbackHours));
    if (inPrimaryWindow.length > 0) {
      return inPrimaryWindow.slice(0, this.maxExternalSignals);
    }
    const inFallbackWindow = allSignals.filter((signal) =>
      this.isWithinHours(signal.publishedAt, this.fallbackContextHours)
    );
    if (inFallbackWindow.length > 0) {
      return inFallbackWindow.slice(0, this.maxExternalSignals);
    }
    return allSignals.slice(0, this.maxExternalSignals);
  }

  private async gatherExternalContextBlock(): Promise<string> {
    const signals = await this.gatherExternalSignals();
    if (!signals.length) {
      return 'No Telegram/RSS/Substack context was retrieved in this run.';
    }
    const lines = signals.map(
      (signal, i) =>
        `${i + 1}. [${signal.source}] ${signal.title}\nTime: ${signal.publishedAt.toISOString()}\nLink: ${signal.link}\nSummary: ${signal.summary}`
    );
    const merged = lines.join('\n\n');
    if (merged.length <= this.maxExternalContextChars) {
      return merged;
    }
    return `${merged.slice(0, this.maxExternalContextChars)}...`;
  }

  private async gatherContext(): Promise<string> {
    const nowIso = new Date().toISOString();
    const fromDate = new Date(Date.now() - this.lookbackHours * 60 * 60 * 1000).toISOString();
    const allowedHandles = this.getFocusedHandles();
    const externalContextBlock = await this.gatherExternalContextBlock();
    const contextPrompt = `${searchPrompt(this.lookbackHours, nowIso)}

Additional context from configured Telegram channels, RSS feeds, and Substack:
${externalContextBlock}

Use the additional context when it improves specificity. Keep citations as links or handles.`;
    const response = await queryOpenAIOAuth(
      [{ role: 'user', content: contextPrompt }],
      { model }
    );
    return response;
  }

  private async getRecentTweets(limit = 12): Promise<ITweet[]> {
    return Tweets.find({
      'author.username': USER_PROFILE,
      'metrics.view_count': { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<ITweet[]>();
  }

  private async buildStyleGuide(): Promise<string> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tweets = await Tweets.find({
      'author.username': USER_PROFILE,
      createdAt: { $gte: thirtyDaysAgo.toISOString() },
      'metrics.view_count': { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean<ITweet[]>();

    if (!tweets.length) {
      return 'No historical style data available. Use concise, high-conviction analyst tone with clear mechanism-level insight.';
    }

    const scored = tweets
      .map((t) => {
        const views = t.metrics?.view_count || 0;
        const engagements =
          (t.metrics?.like_count || 0) +
          (t.metrics?.retweet_count || 0) +
          (t.metrics?.reply_count || 0) +
          (t.metrics?.quote_count || 0);
        return { ...t, engagementRate: views > 0 ? engagements / views : 0 };
      })
      .sort((a, b) => b.engagementRate - a.engagementRate);

    const top = scored
      .slice(0, 6)
      .map((t, i) => `${i + 1}. "${t.text}" (${(t.engagementRate * 100).toFixed(2)}% ER)`);
    const bottom = scored
      .slice(-4)
      .map((t, i) => `${i + 1}. "${t.text}" (${(t.engagementRate * 100).toFixed(2)}% ER)`);
    const recent = (await this.getRecentTweets(10)).map((t, i) => `${i + 1}. "${t.text}"`);

    const guidePrompt = `
      You are extracting writing style signals for one crypto analyst account.

      Objective: maximize account growth to ${FOLLOWER_GOAL} followers while preserving authentic voice and keeping insights relevant to ${EMPLOYER_BRAND} research audience.

      HIGH PERFORMERS:
      ${top.join('\n')}

      LOW PERFORMERS:
      ${bottom.join('\n')}

      MOST RECENT TWEETS:
      ${recent.join('\n') || 'None'}

      Return concise style guidance with this exact structure:
      1) Voice anchors (3 bullets)
      2) Winning patterns (5 bullets)
      3) Anti-patterns to avoid (5 bullets)
      4) Tactical checklist before posting (5 bullets)
    `;

    const response = await queryOpenAIOAuth(
      [
        { role: 'system', content: 'You produce compact style guides from tweet performance data.' },
        { role: 'user', content: guidePrompt }
      ],
      { model, temperature: 0.2 }
    );

    return response;
  }

  private getStrategicContext(): string {
    return [
      `Primary objective: grow from ~2900 to ${FOLLOWER_GOAL} followers with durable audience trust.`,
      `Brand objective: reinforce ${EMPLOYER_BRAND} positioning through thoughtful, high-signal commentary.`,
      'Content objective: prioritize mechanism-level analysis and second-order effects over headline repetition.',
      'Tone objective: high-conviction, concise, non-promotional, no filler language.'
    ].join('\n');
  }

  private async generateTweet(
    context: string,
    performance: PerformanceAnalysis,
    styleGuide: string,
    strategicContext: string
  ): Promise<GeneratedTweet> {
    const nowIso = new Date().toISOString();
    const prompt = GP(context, performance, styleGuide, strategicContext, nowIso, this.lookbackHours);
    const response = await queryOpenAIOAuth([{ role: 'system', content: SP() }, { role: 'user', content: prompt }], {
      model,
      temperature: 0.7
    });
    const content = response;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Grok response');
      }
      return JSON.parse(jsonMatch[0]) as GeneratedTweet;
    } catch (error) {
      console.error('Error parsing generated tweet:', error);
      console.log('Raw response:', response);
      throw error;
    }
  }

  private async verifyTweet(tweet: GeneratedTweet): Promise<VerificationResult> {
    const needsCoinGeckoVerification = this.detectPriceOrVolumeClaims(tweet.content);
    let coinGeckoVerification = '';
    if (needsCoinGeckoVerification) {
      coinGeckoVerification = await this.verifyCoinGeckoData(tweet.content);
    }
    const prompt = VP(tweet, coinGeckoVerification);
    const response = await queryOpenAIOAuth([{ role: 'system', content: SP() }, { role: 'user', content: prompt }], {
      model,
      temperature: 0.3
    });
    const content = response;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from verification response');
      }
      return JSON.parse(jsonMatch[0]) as VerificationResult;
    } catch (error) {
      console.error('Error parsing verification result:', error);
      return { content: tweet.content, verified: false, changes: 'Verification failed to parse', confidence: 0 };
    }
  }

  private detectPriceOrVolumeClaims(content: string): boolean {
    const patterns = [
      /\$[\d,]+(\.\d+)?[kKmMbBtT]?/,
      /[\d,]+(\.\d+)?\s*(million|billion|trillion)/i,
      /(price|volume|market cap|mcap|tvl|fdv)/i,
      /[\d,]+(\.\d+)?%/
    ];
    return patterns.some((pattern) => pattern.test(content));
  }

  private async verifyCoinGeckoData(content: string): Promise<string> {
    try {
      const coinMentions = this.extractCoinMentions(content);
      if (coinMentions.length === 0) {
        return 'No specific coins detected for verification.';
      }
      const verificationPrompt = `Verify the following crypto market claims using CoinGecko data:\n\nTweet: "${content}"\n\nCoins mentioned: ${coinMentions.join(', ')}\n\nPlease check if any price, volume, or market cap figures mentioned are accurate. Return a brief summary of what you verified.`;
      const response = await queryOpenAIOAuth([{ role: 'user', content: verificationPrompt }], {
        model,
        temperature: 0.1
      });
      return response;
    } catch (error) {
      console.error('Error verifying with CoinGecko MCP:', error);
      return 'CoinGecko verification unavailable.';
    }
  }

  private extractCoinMentions(content: string): string[] {
    const coins: string[] = [];
    const patterns = [
      /\b(BTC|Bitcoin)\b/gi,
      /\b(ETH|Ethereum)\b/gi,
      /\b(SOL|Solana)\b/gi,
      /\b(AVAX|Avalanche)\b/gi,
      /\b(MATIC|Polygon)\b/gi,
      /\b(ARB|Arbitrum)\b/gi,
      /\b(OP|Optimism)\b/gi,
      /\b(NEAR)\b/gi,
      /\b(SUI)\b/gi,
      /\b(APT|Aptos)\b/gi,
      /\b(INJ|Injective)\b/gi,
      /\b(SEI)\b/gi,
      /\b(TIA|Celestia)\b/gi,
      /\b(RENDER|RNDR)\b/gi,
      /\b(FIL|Filecoin)\b/gi,
      /\b(AR|Arweave)\b/gi,
      /\b(HNT|Helium)\b/gi,
      /\b(MOBILE)\b/gi,
      /\b(IOT)\b/gi
    ];
    patterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        const match = matches[0].toUpperCase();
        if (!coins.includes(match)) {
          coins.push(match);
        }
      }
    });
    return coins;
  }

  private async sendToTelegram(content: string, meta: any) {
    const message = `*Daily Tweet*\n\n${content}\n\n_Reasoning: ${meta.reasoning || 'N/A'}_\n_Confidence: ${meta.confidence || 'N/A'}_\n_Verified: ${meta.verified ? 'Yes' : 'No'}_`;
    await telegramBot.sendMessage({ text: message, parse_mode: 'Markdown', disable_web_page_preview: true });
  }

  async analyzeHistoricalPerformance(): Promise<PerformanceAnalysis> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tweets = await Tweets.find({
      'author.username': USER_PROFILE,
      createdAt: { $gte: thirtyDaysAgo.toISOString() },
      'metrics.view_count': { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<ITweet[]>();
    if (tweets.length === 0) {
      throw new Error('No historical data found');
    }
    const tweetsWithEngagement = tweets
      .map((t) => {
        const views = t.metrics?.view_count || 0;
        const engagements =
          (t.metrics?.like_count || 0) +
          (t.metrics?.retweet_count || 0) +
          (t.metrics?.reply_count || 0) +
          (t.metrics?.quote_count || 0);
        const engagementRate = views > 0 ? engagements / views : 0;
        return { ...t, calculatedEngagementRate: engagementRate };
      })
      .sort((a, b) => b.calculatedEngagementRate - a.calculatedEngagementRate);
    const totalTweets = tweetsWithEngagement.length;
    const avgViews = tweetsWithEngagement.reduce((sum, t) => sum + (t.metrics?.view_count || 0), 0) / totalTweets;
    const avgLikes = tweetsWithEngagement.reduce((sum, t) => sum + (t.metrics?.like_count || 0), 0) / totalTweets;
    const avgRetweets =
      tweetsWithEngagement.reduce((sum, t) => sum + (t.metrics?.retweet_count || 0), 0) / totalTweets;
    const avgReplies = tweetsWithEngagement.reduce((sum, t) => sum + (t.metrics?.reply_count || 0), 0) / totalTweets;
    const avgEngagement =
      tweetsWithEngagement.reduce((sum, t) => sum + t.calculatedEngagementRate, 0) / totalTweets;
    const topTweets = tweetsWithEngagement.slice(0, 10);
    const avgLength = topTweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / topTweets.length;
    return {
      totalTweets,
      averageMetrics: {
        views: avgViews,
        likes: avgLikes,
        retweets: avgRetweets,
        replies: avgReplies,
        engagementRate: avgEngagement
      },
      bestTweets: topTweets.map((t) => ({
        id: t.id || '',
        text: t.text || '',
        createdAt: t.createdAt || '',
        metrics: {
          view_count: t.metrics?.view_count,
          like_count: t.metrics?.like_count,
          retweet_count: t.metrics?.retweet_count,
          reply_count: t.metrics?.reply_count,
          quote_count: t.metrics?.quote_count
        },
        engagementRate: t.calculatedEngagementRate,
        performanceScore: t.performance?.performance_score || 0
      })),
      optimalTweetLength: Math.round(avgLength)
    };
  }

  public async run() {
    try {
      const [context, performance, styleGuide] = await Promise.all([
        this.gatherContext(),
        this.analyzeHistoricalPerformance(),
        this.buildStyleGuide()
      ]);

      console.log('\n\nContext gathered:', context, '\n\n');
      console.log('\n\nPerformance analysis:', performance, '\n\n');
      console.log('\n\nStyle guide:', styleGuide, '\n\n');

      const strategicContext = this.getStrategicContext();
      const generated = await this.generateTweet(context, performance, styleGuide, strategicContext);
      console.log('\n\nGenerated tweet:', generated, '\n\n');

      const verified = await this.verifyTweet(generated);
      console.log('\n\nVerified tweet:', verified, '\n\n');

      await this.sendToTelegram(verified.content, {
        reasoning: generated.reasoning,
        confidence: verified.confidence,
        verified: verified.verified
      });
    } catch (error) {
      console.error('Error in SocialManagerV2 workflow:', error);
      await telegramBot.sendMessage({
        text: `SocialManagerV2 Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parse_mode: 'Markdown'
      });
    }
  }
}

export const runSocialV2 = async () => {
  const manager = new SocialManagerV2();
  await manager.run();
};
