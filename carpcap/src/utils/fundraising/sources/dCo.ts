import * as fs from 'fs';
import * as path from 'path';
import { FirecrawlScraper, withRateLimitRetry, rateLimitDelay } from '../../utils/firecrawl';
import { DecentralisedCoRaise, SourceConfig } from '../types';

export interface DCoSimplifiedRaise {
    name: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    date: string;
    category: string;
    investors: string[];
    blockchain: string;
    link: string;
    pageFetched: number;
}

export class DCoSource {
    private config: SourceConfig;
    private scraper: FirecrawlScraper;
    private baseUrl = 'https://funding.decentralised.co/api/funding';

    constructor(config: SourceConfig) {
        this.config = config;
        this.scraper = new FirecrawlScraper({apiKey: config.apiKey, timeout: 60000});
    }

    private async fetchPage(pageNumber: number): Promise<{ data: DecentralisedCoRaise[], hasMore: boolean, pagination?: any }> {
        console.log(`\n[Decentralised.co] Scraping page ${pageNumber}...`);
        try {
            const url = `${this.baseUrl}?page=${pageNumber}`;
            console.log(`  -> URL: ${url}`);
            const firecrawl = (this.scraper as any).client;
            const result = await withRateLimitRetry<any>(
                () => firecrawl.scrape(url, {formats: ['markdown']}),
                5,
                `Decentralised.co page ${pageNumber}`
            );
            if (!result.markdown) {throw new Error('No content returned from Firecrawl');}
            const jsonMatch = result.markdown.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {throw new Error('Could not find JSON in response');}
            const jsonData = JSON.parse(jsonMatch[0]);
            const data: DecentralisedCoRaise[] = jsonData.data || [];
            const pagination = jsonData.pagination || {};
            console.log(`  ✓ Scraped ${data.length} rounds`);
            if (pagination.total) {console.log(`  -> Progress: Page ${pagination.page}/${pagination.totalPages} (${pagination.total} total rounds)`);}
            if (!data || data.length === 0) {return { data: [], hasMore: false, pagination };}
            const hasMore = pagination.hasMore !== undefined ? pagination.hasMore : true;
            return { data, hasMore, pagination };
        } 
        catch (error: any) {
            console.error(`  [x] Error scraping page ${pageNumber}:`, error.message);
            return { data: [], hasMore: false, pagination: undefined };
        }
    }

    private simplifyRaise(raise: DecentralisedCoRaise, pageNumber: number): DCoSimplifiedRaise {
        const investors = (raise.investorIdentifiers || []).map(inv => inv.name).filter(name => name && name.trim());
        const categories = (raise.fundedOrganizationCategories || []).map(cat => cat.value).filter(val => val && val.trim()).join(', ');
        const amount = raise.moneyRaised?.valueUsd || null;
        return {
            name: raise.name || raise.fundedOrganizationIdentifier?.value || '',
            round: raise.investmentStage || raise.investmentType || '',
            amount: amount,
            valuation: null, // Not provided in API
            date: raise.announcedOn ? raise.announcedOn.split('T')[0] : '',
            category: categories || raise.secondaryCryptoCategory || '',
            investors: investors,
            blockchain: raise.cryptoChain || '',
            link: raise.fundedOrganizationIdentifier?.permalink 
                ? `https://www.crunchbase.com/${raise.fundedOrganizationIdentifier.permalink}` 
                : '',
            pageFetched: pageNumber
        };
    }

    public async scrapeAndSave(): Promise<string> {
        let allRounds: DCoSimplifiedRaise[] = [];
        let page = 1;
        let hasMore = true;
        console.log(`Backfill: ${this.config.backfillEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Max pages: ${this.config.maxPages || 'unlimited'}\n`);
        let totalPages: number | undefined;
        while (hasMore && (!this.config.maxPages || page <= this.config.maxPages)) {
            try {
                const { data, hasMore: pageHasMore, pagination } = await this.fetchPage(page);
                if (pagination && !totalPages) {
                    totalPages = pagination.totalPages;
                    console.log(`\n  -> Decentralised.co has ${pagination.total} total rounds across ${totalPages} pages\n`);
                }
                if (data.length === 0) {console.log(`  [i] No data on page ${page}, stopping.`); hasMore = false; break;}
                const simplifiedRounds = data.map(r => this.simplifyRaise(r, page));
                allRounds.push(...simplifiedRounds);
                console.log(`  -> Total rounds so far: ${allRounds.length}`);
                hasMore = pageHasMore;
                if (!this.config.backfillEnabled) {console.log(`\n  [i] Backfill disabled, stopping after first page.`); hasMore = false;} 
                else if (!hasMore) {console.log(`\n  [i] Reached end of data (page ${page} of ${totalPages || 'unknown'}).`);} 
                else {page++; await rateLimitDelay(6000);}
            } 
            catch (error: any) {console.error(`  [x] Error on page ${page}: ${error.message}`); hasMore = false;}
        }
        console.log(`\n[OK] Scraping complete! Total rounds: ${allRounds.length}\n`);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `dco-${timestamp}.json`;
        const filepath = path.join(this.config.outputDir || './data', filename);
        if (!fs.existsSync(this.config.outputDir || './data')) {fs.mkdirSync(this.config.outputDir || './data', { recursive: true });}
        fs.writeFileSync(filepath, JSON.stringify({source: 'decentralised.co', scrapedAt: new Date().toISOString(), totalRounds: allRounds.length, rounds: allRounds }, null, 2));
        console.log(`Saved ${allRounds.length} rounds to: ${filepath}`);
        return filepath;
    }

    public getSummary(rounds: DCoSimplifiedRaise[]) {
        const summary = {
            total: rounds.length,
            withAmount: 0,
            withValuation: 0,
            withInvestors: 0,
            withBlockchain: 0,
            avgInvestorsPerRound: 0,
            roundTypes: {} as { [key: string]: number },
            categories: {} as { [key: string]: number },
            blockchains: {} as { [key: string]: number },
        };
        let totalInvestors = 0;
        rounds.forEach(round => {
            if (round.amount !== null) summary.withAmount++;
            if (round.valuation !== null) summary.withValuation++;
            if (round.investors && round.investors.length > 0) {
                summary.withInvestors++;
                totalInvestors += round.investors.length;
            }
            if (round.blockchain) {
                summary.withBlockchain++;
                summary.blockchains[round.blockchain] = (summary.blockchains[round.blockchain] || 0) + 1;
            }
            summary.roundTypes[round.round || 'Unknown'] = (summary.roundTypes[round.round || 'Unknown'] || 0) + 1;
            const cats = round.category.split(',').map(c => c.trim()).filter(c => c);
            cats.forEach(cat => {summary.categories[cat] = (summary.categories[cat] || 0) + 1;});
        });
        summary.avgInvestorsPerRound = summary.withInvestors > 0 ? totalInvestors / summary.withInvestors : 0;
        return summary;
    }
}