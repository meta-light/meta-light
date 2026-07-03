interface TwitterUser {
    type: 'user';
    userName: string;
    url: string;
    twitterUrl: string;
    id: string;
    name: string;
    isVerified: boolean;
    isBlueVerified: boolean;
    verifiedType: string | null;
    profilePicture: string;
    coverPicture: string;
    description: string;
    location: string;
    followers: number;
    following: number;
    status: string;
    canDm: boolean;
    canMediaTag: boolean;
    createdAt: string;
    entities: {description: {urls: Array<{display_url: string; expanded_url: string; indices: [number, number]; url: string;}>;}; url: {urls: Array<{display_url: string; expanded_url: string; indices: [number, number]; url: string;}>;};};
    fastFollowersCount: number;
    favouritesCount: number;
    hasCustomTimelines: boolean;
    isTranslator: boolean;
    mediaCount: number;
    statusesCount: number;
    withheldInCountries: string[];
    affiliatesHighlightedLabel: Record<string, unknown>;
    possiblySensitive: boolean;
    pinnedTweetIds: string[];
    profile_bio: {
      description: string;
      entities: {
        description: {urls: Array<{display_url: string; expanded_url: string; indices: [number, number]; url: string;}>;};
        url: {urls: Array<{display_url: string; expanded_url: string; indices: [number, number]; url: string;}>;};
      };
    };
}
  
export interface TwitterFullApiResponse {
    type: 'tweet';
    id: string;
    url: string;
    twitterUrl: string;
    text: string;
    source: string;
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    viewCount: number;
    createdAt: string;
    lang: string;
    bookmarkCount: number;
    isReply: boolean;
    inReplyToId: string | null;
    conversationId: string;
    displayTextRange: [number, number];
    inReplyToUserId: string | null;
    inReplyToUsername: string | null;
    author: TwitterUser;
    extendedEntities?: {media: {
      additional_media_info: {monetizable: boolean;};
      display_url: string;
      expanded_url: string;
      ext_media_availability: {status: string;};
      id_str: string;
      indices: [number, number];
      media_key: string;
      media_results: {id: string; result: {__typename: string; id: string; media_key: string;};};
      media_url_https: string;
      original_info: {focus_rects: any[]; height: number; width: number;};
      sizes: {large: {h: number; w: number;}; [key: string]: {h: number; w: number;};};
      type: string;
      url: string;
      video_info?: {aspect_ratio: [number, number]; duration_millis: number; variants: {content_type: string; url: string; bitrate?: number;}[];};
    }[];};
    card: {[key: string]: unknown;} | null;
    place: {[key: string]: unknown;};
    entities: {
      user_mentions?: Array<{id_str: string; indices: [number, number]; name: string; screen_name: string;}>;
      urls?: Array<{display_url: string; expanded_url: string; indices: [number, number]; url: string;}>;
    };
    quoted_tweet: any | null;
    retweeted_tweet: any | null;
    isAutomated: boolean;
    automatedBy: any | null;
    isLimitedReply: boolean;
    article: any | null;
}