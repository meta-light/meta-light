export interface ScrapedTweetRecord {
  id: string;
  tweet?: string;
  created_at?: string;
  metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
    view_count?: number;
  };
  permalink?: string;
  quotedTweet?: {
    id?: string;
    tweet?: string;
    created_at?: string;
    permalink?: string;
  };
  screenName?: string;
  scrapedAt?: Date;
}
