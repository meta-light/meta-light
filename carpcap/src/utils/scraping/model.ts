import mongoose from "mongoose";

const tweetSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    tweet: String,
    created_at: String,
    metrics: {
      like_count: Number,
      retweet_count: Number,
      reply_count: Number,
      quote_count: Number,
      view_count: Number
    },
    permalink: String,
    quotedTweet: {
      id: String,
      tweet: String,
      created_at: String,
      permalink: String
    },
    screenName: String,
    scrapedAt: { type: Date, default: Date.now }
});

export const Tweet = mongoose.model('Tweet', tweetSchema, 'carp-tweets');