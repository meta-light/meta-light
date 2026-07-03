import * as fs from 'fs';
import * as path from 'path';
import { FirecrawlScraper, withRateLimitRetry, rateLimitDelay } from '../../utils/firecrawl';
import { LlamaRaise, SourceConfig } from '../types';

export interface LlamaSimplifiedRaise {
    name: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    date: string;
    category: string;
    categoryGroup: string;
    sector: string;
    chains: string[];
    leadInvestors: string[];
    otherInvestors: string[];
    source: string;
    defillamaId?: string;
}

export class LlamaSource {
    private config: SourceConfig;
    private scraper: FirecrawlScraper;
    private apiUrl = 'https://api.llama.fi/raises';

    constructor(config: SourceConfig) {
        this.config = config;
        this.scraper = new FirecrawlScraper({apiKey: config.apiKey, timeout: 60000});
    }

    private async fetchRaises(): Promise<LlamaRaise[]> {
        console.log(`\n[DeFi Llama] Scraping API...`);
        console.log(`  -> URL: ${this.apiUrl}`);
        try {
            const firecrawl = (this.scraper as any).client;
            const result = await withRateLimitRetry<any>(
                () => firecrawl.scrape(this.apiUrl, {formats: ['markdown']}),
                5,
                'DeFi Llama API'
            );
            if (!result.markdown) {throw new Error('No content returned from Firecrawl');}
            const jsonMatch = result.markdown.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {throw new Error('Could not find JSON in response');}
            const jsonData = JSON.parse(jsonMatch[0]);
            const raises: LlamaRaise[] = jsonData.raises || [];
            console.log(`  ✓ Scraped ${raises.length} total rounds`);
            return raises;
        } 
        catch (error: any) {console.error(`  [x] Error scraping DeFi Llama:`, error.message); return [];}
    }

    private simplifyRaise(raise: LlamaRaise): LlamaSimplifiedRaise {
        const date = new Date(raise.date * 1000).toISOString().split('T')[0];
        return {
            name: raise.name || '',
            round: raise.round || '',
            amount: raise.amount || null,
            valuation: raise.valuation || null,
            date: date,
            category: raise.category || '',
            categoryGroup: raise.categoryGroup || '',
            sector: raise.sector || '',
            chains: raise.chains || [],
            leadInvestors: raise.leadInvestors || [],
            otherInvestors: raise.otherInvestors || [],
            source: raise.source || '',
            defillamaId: (raise as any).defillamaId || undefined
        };
    }

    public async scrapeAndSave(): Promise<string> {
        try {
            const rawRaises = await this.fetchRaises();
            if (rawRaises.length === 0) {console.log(`\n[!] No data fetched from DeFi Llama`); return '';}
            const simplifiedRaises = rawRaises.map(r => this.simplifyRaise(r));
            console.log(`\n[OK] Scraping complete! Total rounds: ${simplifiedRaises.length}\n`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `llama-${timestamp}.json`;
            const filepath = path.join(this.config.outputDir || './data', filename);
            if (!fs.existsSync(this.config.outputDir || './data')) {fs.mkdirSync(this.config.outputDir || './data', { recursive: true });}
            fs.writeFileSync(filepath, JSON.stringify({ source: 'defillama', scrapedAt: new Date().toISOString(), totalRounds: simplifiedRaises.length, rounds: simplifiedRaises }, null, 2));
            console.log(`Saved ${simplifiedRaises.length} rounds to: ${filepath}`);
            return filepath;
        } 
        catch (error: any) {console.error(`\n[x] Error in scrapeAndSave:`, error.message); throw error;}
    }

    public getSummary(rounds: LlamaSimplifiedRaise[]) {
        const summary = {
            total: rounds.length,
            withAmount: 0,
            withValuation: 0,
            withLeadInvestors: 0,
            withOtherInvestors: 0,
            withChains: 0,
            avgLeadInvestorsPerRound: 0,
            avgOtherInvestorsPerRound: 0,
            roundTypes: {} as { [key: string]: number },
            categories: {} as { [key: string]: number },
            categoryGroups: {} as { [key: string]: number },
            chains: {} as { [key: string]: number },
        };
        let totalLeadInvestors = 0;
        let totalOtherInvestors = 0;
        rounds.forEach(round => {
            if (round.amount !== null) summary.withAmount++;
            if (round.valuation !== null) summary.withValuation++;
            if (round.leadInvestors && round.leadInvestors.length > 0) {summary.withLeadInvestors++; totalLeadInvestors += round.leadInvestors.length;}
            if (round.otherInvestors && round.otherInvestors.length > 0) {summary.withOtherInvestors++; totalOtherInvestors += round.otherInvestors.length;}
            if (round.chains && round.chains.length > 0) {
                summary.withChains++;
                round.chains.forEach(chain => {if (chain) {summary.chains[chain] = (summary.chains[chain] || 0) + 1;}});
            }
            const roundType = round.round || 'Unknown';
            summary.roundTypes[roundType] = (summary.roundTypes[roundType] || 0) + 1;
            const category = round.category || 'Unknown';
            summary.categories[category] = (summary.categories[category] || 0) + 1;
            const categoryGroup = round.categoryGroup || 'Unknown';
            summary.categoryGroups[categoryGroup] = (summary.categoryGroups[categoryGroup] || 0) + 1;
        });
        summary.avgLeadInvestorsPerRound = summary.withLeadInvestors > 0 ? totalLeadInvestors / summary.withLeadInvestors : 0;
        summary.avgOtherInvestorsPerRound = summary.withOtherInvestors > 0 ? totalOtherInvestors / summary.withOtherInvestors : 0;
        return summary;
    }
}