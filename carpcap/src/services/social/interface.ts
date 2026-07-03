import { NewsItem } from '../news/model';

export interface TrackedProfileTweet {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  metrics: {like_count: number; retweet_count: number; view_count: number;};
}

export interface SocialManagerConfig {targetTopics: string[]; tweetAnalysisLimit: number; newsLookbackDays: number; confidenceThreshold: number;}
export interface GeneratedContent {content: string; type: 'original' | 'quote'; quotedTweetUrl?: string; reasoning: string; confidence: number; verified: boolean; topics: string[]; performanceScore: number;}
  
export interface TweetMetrics {
  id: string;
  text: string;
  createdAt: string;
  metrics: {like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number; view_count?: number;};
  permalink?: string;
  screenName?: string;
  engagementRate: number;
  performanceScore: number;
}
  
export interface PerformanceInsight {
  type: 'content' | 'timing' | 'topic' | 'format';
  insight: string;
  confidence: number;
  supportingData: any;
}
  
export interface PerformanceAnalysis {
  totalTweets: number;
  bestTweets: TweetMetrics[];
  optimalTweetLength: number;
  averageMetrics: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    engagementRate: number;
  };
}

export interface TweetData {
  id: string;
  tweet: string;
  created_at: string;
  metrics: {like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number; view_count?: number;};
  permalink?: string;
  screenName?: string;
}

export interface GeneratedTweet {content: string; type: 'original' | 'quote'; quotedTweetUrl?: string; reasoning: string; confidence: number; verified?: boolean; topics?: string[];}
export interface TweetAnalysisData {latestTweets: TweetData[]; bestTweets: TweetData[]; relevantNews: NewsItem[]; generatedAt: string;}

export interface TweetAnalysisResult {
  tweet: TweetMetrics;
  analysis: {
    performanceRating: 'excellent' | 'good' | 'average' | 'poor';
    comparisonToAverage: {
      viewsVsAvg: number;
      likesVsAvg: number;
      retweetsVsAvg: number;
      engagementRateVsAvg: number;
    };
    strengths: string[];
    weaknesses: string[];
  };
}

export interface BatchAnalysisResult {
  analyzedTweets: TweetAnalysisResult[];
  summary: {
    totalAnalyzed: number;
    excellent: number;
    good: number;
    average: number;
    poor: number;
    topPerformer: TweetMetrics | null;
    worstPerformer: TweetMetrics | null;
    keyInsights: string[];
  };
}

export interface GeneratedTweet {
  content: string;
  type: 'original' | 'quote';
  quotedTweetUrl?: string;
  reasoning: string;
  confidence: number;
  verified?: boolean;
  topics?: string[];
}

export interface VerificationResult {content: string; verified: boolean; changes: string; confidence: number;}
export interface SearchResult {summary: string; narratives: string[]; top_sources: { url: string; title: string }[];}