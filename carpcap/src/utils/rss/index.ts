export interface RSSArticle {
    title: string;
    link: string;
    pubDate: string;
    description?: string;
    content?: string;
    feedName: string;
}

export interface RSSFeed {name: string; url: string; pagination?: 'wordpress' | 'arc' | undefined;}

export function parseRSSFeed(xml: string, feedName: string): any[] {
    const articles: any[] = [];
    try {
        const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
        const items = xml.match(itemRegex);
        if (!items) return articles;
        for (const itemXml of items) {
            const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
            const title = titleMatch?.[1]?.trim();
            const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
            const link = linkMatch?.[1]?.trim();
            const dateMatch = itemXml.match(/<(?:pubDate|published|updated)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated)>/i);
            const pubDate = dateMatch?.[1]?.trim();
            const descMatch = itemXml.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i);
            let description = descMatch?.[1]?.trim();
            if (description) {description = description.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();}
            if (title && link && pubDate) {articles.push({ title, link, pubDate: new Date(pubDate), description, feedName });}
        }
    } 
    catch (error) {console.error(`Error parsing RSS feed ${feedName}:`, error);}
    return articles;
}

export function buildPageUrl(feed: RSSFeed, page: number): string {
    const base = feed.url.replace(/\?.*$/, '');
    const existingQuery = feed.url.includes('?') ? feed.url.slice(feed.url.indexOf('?')) : '';
    const sep = existingQuery ? (existingQuery.endsWith('&') ? '' : '&') : '?';
    if (page === 1 && feed.pagination !== 'wordpress') return feed.url;
    if (feed.pagination === 'arc') {
        const from = (page - 1) * 25;
        return `${base}${existingQuery}${sep}from=${from}&size=${25}`;
    }
    if (feed.pagination === 'wordpress') {
        const pagedPart = page === 1 ? '' : `paged=${page}&`;
        return `${base}${existingQuery}${sep}${pagedPart}per_page=${50}`;
    }
    return existingQuery ? `${base}${existingQuery}${sep}paged=${page}` : `${base}?paged=${page}`;
}

export async function fetchRSSFeedPaginated(feed: RSSFeed, maxPages: number = 5, opts?: { checkHasExisting?: (links: string[]) => Promise<boolean> }): Promise<any[]> {
    const seen = new Set<string>();
    const all: any[] = [];
    for (let p = 1; p <= maxPages; p++) {
        try {
            const pageUrl = buildPageUrl(feed, p);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) {
                if (p === 1) console.error(`  ${feed.name}: fetch failed ${res.status} ${res.statusText} — ${res.status === 429 ? 'rate limited or blocked (try again later)' : 'check URL'}`);
                break;
            }
            const xml = await res.text();
            const items = parseRSSFeed(xml, feed.name);
            if (!items.length) {
                if (p === 1 && xml.length > 0 && !xml.trimStart().startsWith('<?xml') && !xml.trimStart().startsWith('<rss')) {
                    console.error(`  ${feed.name}: got HTML instead of RSS (${xml.length} chars) — feed may block server requests`);
                }
                break;
            }
            let added = 0;
            for (const a of items) {if (!seen.has(a.link)) { seen.add(a.link); all.push(a); added++; }}
            if (added === 0) break;
            const links = items.map((a) => a.link).filter(Boolean);
            if (opts?.checkHasExisting && links.length > 0 && (await opts.checkHasExisting(links))) break;
            if (p % 50 === 0) console.log(`    ${feed.name}: page ${p}, ${all.length} items so far`);
            if (p > 1) await new Promise(r => setTimeout(r, 10));
        }
        catch (e: any) {
            if (e?.name === 'AbortError') console.error(`  ${feed.name}: fetch timeout on page ${p}`);
            break;
        }
    }
    return all;
}

export async function fetchRSSFeed(feed: { name: string; url: string }): Promise<any[]> {return fetchRSSFeedPaginated(feed, 1);}