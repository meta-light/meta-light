export interface ITweet {
  id: string;
  text: string;
  createdAt: string;
  publishedAt: Date;
  lastUpdated: Date;
  isReply: boolean;
  inReplyToId?: string;
  inReplyToUsername?: string;
  conversationId?: string;
  metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    view_count: number;
  };
  urls: string[];
  media: Array<{
    type: string;
    url: string;
    media_url: string;
  }>;
  author: {
    id: string;
    username: string;
    name: string;
    verified: boolean;
    followers_count: number;
    following_count: number;
  };
  analysis: {
    sentiment?: string;
    topics?: string[];
    hashtags?: string[];
    mentions?: string[];
    language?: string;
    word_count?: number;
    character_count?: number;
  };
  performance: {
    engagement_rate: number;
    performance_score: number;
    viral_potential: number;
    last_metrics_update?: Date | string;
  };
  source: {
    api?: string;
    fetched_at?: Date | string;
    processed?: boolean;
    processing_errors?: string[];
  };
  analyzed?: boolean;
  analyzedAt?: Date;
  analysisResults?: {
    performanceRating?: string;
    engagementRateVsAvg?: number;
    viewsVsAvg?: number;
    aiInsights?: string;
  };
  calculated_engagement_rate: number;
}

export function calculatePerformanceScore(metrics: ITweet['metrics']): number {
  const weights = {
    views: 0.1,
    likes: 0.25,
    retweets: 0.35,
    replies: 0.2,
    quotes: 0.1,
  };
  const normalizedViews = Math.min((metrics.view_count || 0) / 10000, 1);
  const normalizedLikes = Math.min((metrics.like_count || 0) / 1000, 1);
  const normalizedRetweets = Math.min((metrics.retweet_count || 0) / 500, 1);
  const normalizedReplies = Math.min((metrics.reply_count || 0) / 200, 1);
  const normalizedQuotes = Math.min((metrics.quote_count || 0) / 100, 1);
  return (
    normalizedViews * weights.views +
    normalizedLikes * weights.likes +
    normalizedRetweets * weights.retweets +
    normalizedReplies * weights.replies +
    normalizedQuotes * weights.quotes
  );
}
