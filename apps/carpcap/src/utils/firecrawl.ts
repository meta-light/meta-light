import Firecrawl from '@mendable/firecrawl-js';

export interface ScraperConfig {apiKey: string; timeout?: number;}

export interface ScrapeResult {
    success: boolean;
    markdown?: string;
    html?: string;
    json?: any;
    error?: string;
    metadata?: {title?: string; url?: string; statusCode?: number;};
}

export interface ScraperProvider {
    name: string;
    scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResult>;
    scrapeWithSchema?<T>(url: string, schema: any): Promise<T>;
}

export interface ScrapeOptions {
    formats?: ('markdown' | 'html' | 'json')[];
    waitForSelector?: string;
    timeout?: number;
    useProxy?: boolean;
    solveCaptchas?: boolean;
}

export interface FundraisingRound {
    name: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    date: string;
    category: string;
    investors: string[];
    ecosystem: string[];
}

export class FirecrawlScraper implements ScraperProvider {
    public readonly name = 'Firecrawl';
    private client: Firecrawl;
    private config: ScraperConfig;

    constructor(config: ScraperConfig) {
        this.config = config;
        this.client = new Firecrawl({ apiKey: config.apiKey });
    }

    async scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
        try {
            console.log(`[Firecrawl] Scraping ${url}...`);
            const formats = options?.formats || ['markdown'];
            const result = await this.client.scrape(url, {formats: formats as any, timeout: options?.timeout || this.config.timeout || 30000});
            return {
                success: true,
                markdown: result.markdown,
                html: result.html,
                metadata: {title: result.metadata?.title, url: result.metadata?.sourceURL, statusCode: result.metadata?.statusCode}
            };
        } 
        catch (error: any) {
            console.error(`[Firecrawl] Error scraping ${url}:`, error.message);
            return {success: false, error: error.message};
        }
    }

    async scrapeWithSchema<T>(url: string, schema: any): Promise<T> {
        try {
            console.log(`[Firecrawl] Scraping ${url} with schema...`);
            const result = await this.client.scrape(url, {formats: [{type: 'json', schema: schema}] as any});
            return result.json as T;
        } 
        catch (error: any) {console.error(`[Firecrawl] Error scraping with schema:`, error.message); throw error;}
    }

    async crawl(url: string, options?: { limit?: number }): Promise<any> {
        try {
            console.log(`[Firecrawl] Crawling ${url}...`);
            const docs = await this.client.crawl(url, {limit: options?.limit || 10});
            return docs;
        } 
        catch (error: any) {console.error(`[Firecrawl] Error crawling ${url}:`, error.message); throw error;}
    }
}

export async function withRateLimitRetry<T>(operation: () => Promise<T>, maxRetries: number = 5, context: string = 'Firecrawl request'): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {return await operation();} 
        catch (error: any) {
            lastError = error;
            const isRateLimit = error.message && (error.message.includes('Rate limit') || error.message.includes('rate limit') || error.message.includes('429'));
            if (isRateLimit && attempt < maxRetries) {
                const retryMatch = error.message.match(/retry after (\d+)s/);
                const waitSeconds = retryMatch ? parseInt(retryMatch[1]) : 60;
                console.log(`Rate limited on ${context} (attempt ${attempt}/${maxRetries})`);
                console.log(`Waiting ${waitSeconds} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                console.log(`  ↻ Retrying ${context}...`);
            } 
            else if (!isRateLimit) {throw error;} 
            else {console.error(`  ✗ Max retries (${maxRetries}) reached for ${context}`); throw error;}
        }
    }
    throw lastError || new Error('Unknown error in withRateLimitRetry');
}

export async function rateLimitDelay(milliseconds: number = 6000) {await new Promise(resolve => setTimeout(resolve, milliseconds));}