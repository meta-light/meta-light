import "dotenv/config";
import { SubstackClient, type Comment, type FullPost, type Note, type OwnProfile, type PreviewPost, type Profile as ApiProfile } from "substack-api";
import { SUBSTACK_TOKEN } from "../../env";
import { normalizeToken, normalizeHostname, normalizeSlug, toNullableFiniteNumber } from "../index";

// https://substack-api.readthedocs.io/api-reference/

export type Post = {
    id?: number;
    title?: string;
    canonical_url?: string;
    post_date?: string;
    reaction_count?: number;
    comment_count?: number;
    restacks?: number;
    views?: number;
    view_count?: number;
    page_views?: number;
    unique_views?: number;
    total_views?: number;
};

export type EngagementPost = {
    id: number | null;
    title: string;
    publishedAt: string | null;
    canonicalUrl: string | null;
    likes: number | null;
    comments: number | null;
    restacks: number | null;
};

export type EngagementResult = {profile: Profile; posts: EngagementPost[];};
export type Profile = {id?: number; name?: string; handle?: string;};
export type ProfilePostsResponse = {posts?: Post[];};
export interface SubstackAccount {name: string; slug: string; url?: string; maxPosts?: number;}

export class SubstackService {
    private readonly token: string;
    private readonly hostname: string;
    private readonly defaultLimit: number;
    private readonly client: SubstackClient;
    private readonly cookieHeader: HeadersInit;

   constructor() {
        this.token = normalizeToken(SUBSTACK_TOKEN);
        if (!this.token) {throw new Error("Missing SUBSTACK_TOKEN. Set connect.sid in your environment.");}
        this.hostname = normalizeHostname('substack.com');
        this.defaultLimit = 10;
        this.client = new SubstackClient({
            token: this.token,
            publicationUrl: this.hostname,
            substackUrl: this.hostname,
        });
        this.cookieHeader = {Cookie: `connect.sid=${this.token}`, "Content-Type": "application/json"};
    }

    async testConnectivity(): Promise<boolean> {return this.client.testConnectivity();}
    async ownProfile(): Promise<OwnProfile> {return this.client.ownProfile();}
    async profileForSlug(slug: string): Promise<ApiProfile> {return this.client.profileForSlug(normalizeSlug(slug));}
    async profileForId(id: number): Promise<ApiProfile> {return this.client.profileForId(id);}
    async postForId(id: number): Promise<FullPost> {return this.client.postForId(id);}
    async noteForId(id: number): Promise<Note> {return this.client.noteForId(id);}
    async commentForId(id: number): Promise<Comment> {return this.client.commentForId(id);}

    async posts(slug: string, limit = this.defaultLimit): Promise<PreviewPost[]> {
        const profile = await this.profileForSlug(slug);
        const results: PreviewPost[] = [];
        for await (const post of profile.posts({ limit })) {results.push(post);}
        return results;
    }

    async notes(slug: string, limit = this.defaultLimit): Promise<Note[]> {
        const profile = await this.profileForSlug(slug);
        const results: Note[] = [];
        for await (const note of profile.notes({ limit })) {results.push(note);}
        return results;
    }

    async comments(postId: number, limit = this.defaultLimit): Promise<Comment[]> {
        const post = await this.postForId(postId);
        const results: Comment[] = [];
        for await (const comment of post.comments({ limit })) {results.push(comment);}
        return results;
    }

    async getPublicProfile(slugInput: string): Promise<Profile> {
        const slug = normalizeSlug(slugInput);
        if (!slug) {throw new Error("Missing slug");}
        return this.getJson<Profile>(`https://substack.com/api/v1/user/${slug}/public_profile`);
    }

    async getProfilePosts(profileUserId: number, limit = this.defaultLimit, offset = 0): Promise<Post[]> {
        const response = await this.getJson<ProfilePostsResponse>(`https://substack.com/api/v1/profile/posts?profile_user_id=${profileUserId}&limit=${limit}&offset=${offset}`);
        return Array.isArray(response?.posts) ? response.posts : [];
    }

    async getPosts(slugInput: string, limit = this.defaultLimit): Promise<EngagementResult> {
        const profile = await this.getPublicProfile(slugInput);
        if (!profile.id) {throw new Error(`Could not resolve profile id for slug "${slugInput}"`);}
        const posts = await this.getProfilePosts(profile.id, limit, 0);
        const mapped = posts.map((post) => ({
            id: post.id ?? null,
            title: post.title || "(untitled)",
            publishedAt: post.post_date || null,
            canonicalUrl: post.canonical_url || null,
            likes: toNullableFiniteNumber(post.reaction_count),
            comments: toNullableFiniteNumber(post.comment_count),
            restacks: toNullableFiniteNumber(post.restacks),
        }));
        return {profile, posts: mapped};
    }
    private async getJson<T>(url: string): Promise<T> {
        const response = await fetch(url, { headers: this.cookieHeader });
        if (!response.ok) {throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`);}
        return response.json() as Promise<T>;
    }
}

let substackClient: SubstackService | null = null;

export function getSubstackClient(): SubstackService {
    if (!substackClient) substackClient = new SubstackService();
    return substackClient;
}

export function buildSubstackFeedName(slugInput: string): string {
    const slug = normalizeSlug(slugInput);
    return `Substack: @${slug || slugInput}`;
}

function resolveSubstackPublication(account: SubstackAccount): string {
    const fromUrl = account.url?.trim();
    if (fromUrl) {
        try {
            const parsed = new URL(fromUrl);
            const host = parsed.hostname.toLowerCase();
            if (host.endsWith(".substack.com")) {
                const publication = host.slice(0, -".substack.com".length);
                if (publication && publication !== "www") return publication;
            }
        } catch {
            // fallback below
        }
    }
    return normalizeSlug(account.slug || account.name);
}

function parseDateSafe(value: any): Date {
    if (value == null) return new Date();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
}

function cleanHtmlText(value?: string): string {
    if (!value) return "";
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function parseSubstackRss(xml: string, feedName: string): any[] {
    const posts: any[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const dateMatch = itemXml.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i);
        const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const contentMatch = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
        const title = cleanHtmlText(titleMatch?.[1]);
        const link = linkMatch?.[1]?.trim();
        const pubDate = parseDateSafe(dateMatch?.[1]);
        const description = cleanHtmlText(descMatch?.[1]);
        const content = cleanHtmlText(contentMatch?.[1]);
        if (!title || !link) continue;
        posts.push({
            title,
            link,
            pubDate,
            description: description || undefined,
            content: content || description || undefined,
            feedName,
        });
    }
    return posts;
}

function hasPublicationUrl(account: SubstackAccount): boolean {
    const url = account.url?.trim();
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.hostname.toLowerCase().endsWith(".substack.com");
    } catch {
        return false;
    }
}

async function fetchSubstackRssFallback(account: SubstackAccount, limit: number): Promise<any[]> {
    const publication = resolveSubstackPublication(account);
    if (!publication) return [];
    const feedUrl = account.url ? `${account.url.replace(/\/+$/, "")}/feed` : `https://${publication}.substack.com/feed`;
    try {
        const response = await fetch(feedUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Fundraise Scraper/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            },
        });
        if (!response.ok) return [];
        const xml = await response.text();
        const feedName = buildSubstackFeedName(publication);
        const items = parseSubstackRss(xml, feedName);
        return items.slice(0, limit);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching Substack RSS fallback ${account.name || publication}: ${message}`);
        return [];
    }
}

export async function fetchSubstackFeed(account: SubstackAccount, limit?: number): Promise<any[]> {
    const slug = normalizeSlug(account.slug || account.url || account.name);
    if (!slug) return [];
    const maxPosts = limit ?? account.maxPosts ?? 50;
    if (hasPublicationUrl(account)) {
        return fetchSubstackRssFallback(account, maxPosts);
    }
    try {
        const { posts } = await getSubstackClient().getPosts(slug, maxPosts);
        const feedName = buildSubstackFeedName(slug);
        return posts
            .filter((post) => !!post.canonicalUrl)
            .map((post) => {
                const title = post.title || "(untitled)";
                return {
                    title,
                    link: post.canonicalUrl as string,
                    pubDate: parseDateSafe(post.publishedAt),
                    description: title,
                    content: title,
                    feedName,
                };
            });
    } catch (error) {
        return fetchSubstackRssFallback(account, maxPosts);
    }
}
