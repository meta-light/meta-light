import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { FirecrawlScraper, withRateLimitRetry, rateLimitDelay } from '../../utils/firecrawl';
import { CryptoRankRaise, SourceConfig } from '../types';
import { parseAmount } from '../utils';

export class CryptoRankSource {
    private scraper: FirecrawlScraper;
    private config: SourceConfig;
    private baseUrl = 'https://cryptorank.io/funding-rounds';

    constructor(config: SourceConfig) {
        this.config = config;
        this.scraper = new FirecrawlScraper({apiKey: config.apiKey, timeout: 60000});
    }

    private async scrapePage(pageNumber: number): Promise<CryptoRankRaise[]> {
        console.log(`\n[CryptoRank] Scraping page ${pageNumber}...`);
        const url = `${this.baseUrl}?page=${pageNumber}&rows=20`;
        console.log('  → Fetching HTML with Firecrawl...');
        const firecrawl = (this.scraper as any).client;
        const result = await withRateLimitRetry<any>(
            () => firecrawl.scrape(url, {
                formats: ['html'],
                actions: [
                    { type: 'wait', milliseconds: 3000 },
                    { type: 'scroll', direction: 'down' },
                    { type: 'wait', milliseconds: 1500 },
                    { type: 'scroll', direction: 'down' },
                    { type: 'wait', milliseconds: 1500 },
                    { type: 'scroll', direction: 'down' },
                    { type: 'wait', milliseconds: 2000 }
                ]
            }),
            5,
            `CryptoRank page ${pageNumber}`
        );
        if (!result.html) {throw new Error(`No HTML returned for page ${pageNumber}`);}
        console.log('  → Parsing HTML table...');
        const $ = cheerio.load(result.html);
        const rounds: CryptoRankRaise[] = [];
        $('tr').each((_, row) => {
            const tds = $(row).find('td');
            if (tds.length < 5) return;
            const name = $(tds[0]).text().trim();
            const amountText = $(tds[1]).text().trim();
            const roundType = $(tds[2]).text().trim();
            const investorsText = $(tds[3]).text().trim();
            const date = $(tds[4]).text().trim();
            if (!name || name.length < 2 || name.toLowerCase() === 'exclusive') {return;}
            const investors: string[] = [];
            if (investorsText && investorsText !== 'Not Set' && investorsText !== 'N/A') {
                const cleanedText = investorsText.replace(/\+\d+$/, '').trim();
                if (cleanedText) {const invNames = cleanedText.split(/[,;]/).map(inv => inv.trim()).filter(inv => inv.length > 0); investors.push(...invNames);}
            }
            const amount = amountText === 'N/A' ? null : parseAmount(amountText);
            rounds.push({
                name,
                round: roundType,
                amount,
                valuation: null,
                date,
                category: '',
                blockchain: [],
                investors,
                link: `https://cryptorank.io/ico/${name.toLowerCase().replace(/\s+/g, '-')}`,
                pageFetched: pageNumber
            });
        });
        console.log(`  ✓ Parsed ${rounds.length} rounds from HTML`);
        return rounds;
    }

    public async scrapeAndSave(): Promise<string> {
        let allRounds: CryptoRankRaise[] = [];
        let page = 1;
        let hasMorePages = true;
        console.log(`Backfill: ${this.config.backfillEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Max pages: ${this.config.maxPages || 'unlimited'}`);
        console.log(`Note: Using direct HTML parsing for better reliability\n`);
        while (hasMorePages && (!this.config.maxPages || page <= this.config.maxPages)) {
            try {
                const rounds = await this.scrapePage(page);
                if (rounds.length === 0) {console.log(`  ℹ No rounds found on page ${page}, stopping.`); hasMorePages = false; break;}
                allRounds.push(...rounds);
                console.log(`  ✓ Total rounds so far: ${allRounds.length}`);
                if (!this.config.backfillEnabled) {console.log(`\n  ℹ Backfill disabled, stopping after first page.`); hasMorePages = false;} 
                else {page++; await rateLimitDelay(6000);}
            } 
            catch (error: any) {
                console.error(`  ✗ Error on page ${page}: ${error.message}`);
                hasMorePages = false;
            }
        }
        console.log(`\nScraping complete! Total rounds: ${allRounds.length}\n`);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cryptorank-${timestamp}.json`;
        const filepath = path.join(this.config.outputDir || './data', filename);
        if (!fs.existsSync(this.config.outputDir || './data')) {fs.mkdirSync(this.config.outputDir || './data', { recursive: true });}
        fs.writeFileSync(filepath, JSON.stringify({ source: 'cryptorank', scrapedAt: new Date().toISOString(), totalRounds: allRounds.length, rounds: allRounds }, null, 2));
        console.log(`Saved ${allRounds.length} rounds to: ${filepath}`);
        return filepath;
    }

    public getSummary(rounds: CryptoRankRaise[]) {
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
            if (round.investors && round.investors.length > 0) {summary.withInvestors++; totalInvestors += round.investors.length;}
            if (round.blockchain && round.blockchain.length > 0) {
                summary.withBlockchain++;
                round.blockchain.forEach(bc => {summary.blockchains[bc] = (summary.blockchains[bc] || 0) + 1;});
            }
            summary.roundTypes[round.round] = (summary.roundTypes[round.round] || 0) + 1;
            summary.categories[round.category] = (summary.categories[round.category] || 0) + 1;
        });
        summary.avgInvestorsPerRound = summary.withInvestors > 0 ? totalInvestors / summary.withInvestors : 0;
        return summary;
    }
}