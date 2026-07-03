import mongoose from 'mongoose';

export const tweetSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: String, 
    required: true,
    index: true 
  },
  publishedAt: { 
    type: Date, 
    default: Date.now 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  isReply: { 
    type: Boolean, 
    default: false 
  },
  inReplyToId: String,
  inReplyToUsername: String,
  conversationId: String,
  metrics: {
    like_count: { type: Number, default: 0 },
    retweet_count: { type: Number, default: 0 },
    reply_count: { type: Number, default: 0 },
    quote_count: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 }
  },
  urls: [String],
  media: [{
    type: String,
    url: String,
    media_url: String
  }],
  author: {
    id: String,
    username: String,
    name: String,
    verified: Boolean,
    followers_count: Number,
    following_count: Number
  },
  analysis: {
    sentiment: String,
    topics: [String],
    hashtags: [String],
    mentions: [String],
    language: String,
    word_count: Number,
    character_count: Number
  },
  performance: {
    engagement_rate: { type: Number, default: 0 },
    performance_score: { type: Number, default: 0 },
    viral_potential: { type: Number, default: 0 },
    last_metrics_update: Date
  },
  source: {
    api: { type: String, default: 'twitterapi.io' },
    fetched_at: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false },
    processing_errors: [String]
  },
  analyzed: {
    type: Boolean,
    default: false,
    index: true
  },
  analyzedAt: {
    type: Date
  },
  analysisResults: {
    performanceRating: String,
    engagementRateVsAvg: Number,
    viewsVsAvg: Number,
    aiInsights: String
  }
}, {timestamps: true, collection: 'tweets'});

tweetSchema.index({ createdAt: -1 });
tweetSchema.index({ 'metrics.view_count': -1 });
tweetSchema.index({ 'performance.engagement_rate': -1 });
tweetSchema.index({ 'analysis.topics': 1 });
tweetSchema.index({ 'source.fetched_at': -1 });

tweetSchema.virtual('calculated_engagement_rate').get(function(this: any) {
  const views = this.metrics?.view_count || 0;
  if (views === 0) return 0;
  const engagements = (this.metrics?.like_count || 0) + (this.metrics?.retweet_count || 0) + (this.metrics?.reply_count || 0) + (this.metrics?.quote_count || 0);
  return engagements / views;
});

tweetSchema.pre('save', function(this: any, next) {
  const views = this.metrics?.view_count || 0;
  if (views > 0 && this.performance) {
    const engagements = (this.metrics?.like_count || 0) + (this.metrics?.retweet_count || 0) + (this.metrics?.reply_count || 0) + (this.metrics?.quote_count || 0);
    this.performance!.engagement_rate = engagements / views;
  }
  if (this.text && this.analysis) {this.analysis!.character_count = this.text.length; this.analysis!.word_count = this.text.split(/\s+/).length;}
  if (this.lastUpdated !== undefined) {this.lastUpdated = new Date();}
  next();
});

tweetSchema.statics.calculatePerformanceScore = function(metrics: any) {
  const weights = {views: 0.1, likes: 0.25, retweets: 0.35, replies: 0.2, quotes: 0.1};
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
};

export const Tweets = mongoose.model('Tweet', tweetSchema, 'tweets');

export interface ITweet extends mongoose.Document {
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
    sentiment: string;
    topics: string[];
    hashtags: string[];
    mentions: string[];
    language: string;
    word_count: number;
    character_count: number;
  };
  performance: {
    engagement_rate: number;
    performance_score: number;
    viral_potential: number;
    last_metrics_update: Date;
  };
  source: {
    api: string;
    fetched_at: Date;
    processed: boolean;
    processing_errors: string[];
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
