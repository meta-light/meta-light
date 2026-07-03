import * as fs from 'fs';
import * as path from 'path';
import { FirecrawlScraper, withRateLimitRetry, rateLimitDelay } from '../../utils/firecrawl';
import { IcoDropsRaise, SourceConfig } from '../types';
import { parseAmount } from '../utils';

export class IcoDropsSource {
    private scraper: FirecrawlScraper;
    private config: SourceConfig;
    private baseUrl = 'https://icodrops.com/vc/funding-rounds/';

    constructor(config: SourceConfig) {
        this.config = config;
        this.scraper = new FirecrawlScraper({apiKey: config.apiKey, timeout: 60000});
    }

    private extractAllInvestorsFromHTML(html: string): { [projectName: string]: string[] } {
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const investorsByProject: { [projectName: string]: string[] } = {};
        $('li.Tbl-Row').each((_: any, row: any) => {
            const projectName = $(row).find('.Cll-Project__name').text().trim();
            if (projectName) {
                const investors: string[] = [];
                $(row).find('.Stacked-Images__item[data-tooltip-text]').each((_idx: any, investorEl: any) => {
                    const investorName = $(investorEl).attr('data-tooltip-text');
                    if (investorName && 
                        !investorName.includes('Details') && 
                        !investorName.includes('traded on') && 
                        !investorName.includes('added in the last') &&
                        !investorName.includes('More Details') &&
                        !investors.includes(investorName)) {
                        investors.push(investorName);
                    }
                });
                investorsByProject[projectName] = investors;
            }
        });
        return investorsByProject;
    }

    private extractInvestorsFromHTML(html: string, projectName: string): string[] {
        const projectRegex = new RegExp(`class="Cll-Project__name"[^>]*>${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<`, 'i');
        const projectMatch = html.match(projectRegex);
        if (!projectMatch) {return [];}
        const startIndex = projectMatch.index || 0;
        const nextProjectMatch = html.slice(startIndex + 100).match(/class="Tbl-Row"/);
        const endIndex = nextProjectMatch ? startIndex + 100 + (nextProjectMatch.index || 0) : startIndex + 5000;
        const projectSection = html.slice(startIndex, endIndex);
        const investorMatches = projectSection.matchAll(/data-tooltip-text="([^"]+)"/g);
        const investors: string[] = [];
        for (const match of investorMatches) {
            const name = match[1];
            if (!name.includes('Details') && 
                !name.includes('traded on') && 
                !name.includes('added in the last') &&
                !name.includes('More Details') &&
                !name.includes('fire') &&
                name.length > 2) {
                investors.push(name);
            }
        }
        return investors;
    }

    private parseMarkdownToRounds(markdown: string, pageNumber: number): IcoDropsRaise[] {
        const rounds: IcoDropsRaise[] = [];
        const lines = markdown.split('\n');
        let currentRound: any = {};
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const projectMatch = line.match(/\[([^\]]+)\]\(https:\/\/icodrops\.com\/([^\/]+)\/\)/);
            if (projectMatch) {
                if (currentRound.name && currentRound.date) {rounds.push(this.finalizeRound(currentRound, pageNumber));}
                currentRound = {name: projectMatch[1], link: `https://icodrops.com/${projectMatch[2]}/`};
                continue;
            }
            if (line.match(/\b(Seed|Series [A-F]|Strategic|Funding|Private|Public|Angel|M&A)/i)) {if (!currentRound.round) currentRound.round = line;}
            const amountMatch = line.match(/\$[\d.]+\s*[MB]/i);
            if (amountMatch && !currentRound.amount) {currentRound.amount = amountMatch[0];}
            const dateMatch = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
            if (dateMatch && !currentRound.date) {currentRound.date = dateMatch[0];}
        }
        if (currentRound.name && currentRound.date) {rounds.push(this.finalizeRound(currentRound, pageNumber));}
        return rounds;
    }
    
    private finalizeRound(round: any, pageNumber: number): IcoDropsRaise {
        return {
            name: round.name || '',
            round: round.round || '',
            amount: parseAmount(round.amount || ''),
            valuation: parseAmount(round.valuation || ''),
            date: round.date || '',
            category: round.category || '',
            investors: round.investors || [],
            ecosystem: [],
            link: round.link || '',
            pageFetched: pageNumber
        };
    }

    private parseHtmlToRounds(html: string, pageNumber: number): IcoDropsRaise[] {
        const rounds: IcoDropsRaise[] = [];
        const rowMatches = html.matchAll(/class="Tbl-Row"[^>]*>([\s\S]*?)(?=class="Tbl-Row"|$)/g);
        for (const rowMatch of rowMatches) {
            const rowHtml = rowMatch[1];
            const nameMatch = rowHtml.match(/class="Cll-Project__name"[^>]*>([^<]+)</);
            if (!nameMatch) continue;
            const name = nameMatch[1].trim();
            const roundMatch = rowHtml.match(/Tbl-Row__item--round[^>]*>[\s\S]*?>([^<]+)</);
            const round = roundMatch ? roundMatch[1].trim() : '';
            const amountMatch = rowHtml.match(/Tbl-Row__item--raised[\s\S]*?Cll-Value[^>]*>([^<]+)</);
            const amountStr = amountMatch ? amountMatch[1].trim() : null;
            const valuationMatch = rowHtml.match(/Tbl-Row__item--pre-valuation[\s\S]*?Cll-Value[^>]*>([^<]+)</);
            const valuationStr = valuationMatch ? valuationMatch[1].trim() : null;
            const dateMatch = rowHtml.match(/Tbl-Row__item--date[\s\S]*?<time[^>]*>([^<]+)</);
            const date = dateMatch ? dateMatch[1].trim() : '';
            const categoryMatch = rowHtml.match(/Tbl-Row__item--categories[\s\S]*?Cll-Value[^>]*>([^<]+)</);
            const category = categoryMatch ? categoryMatch[1].trim() : '';
            const investors: string[] = [];
            const investorMatches = rowHtml.matchAll(/data-tooltip-text="([^"]+)"/g);
            for (const inv of investorMatches) {
                const invName = inv[1];
                if (!invName.includes('Details') && 
                    !invName.includes('traded on') && 
                    !invName.includes('added in the last') &&
                    invName.length > 2) {
                    investors.push(invName);
                }
            }            
            rounds.push({
                name,
                round,
                amount: parseAmount(amountStr || ''),
                valuation: parseAmount(valuationStr || ''),
                date,
                category,
                investors,
                ecosystem: [],
                link: `https://icodrops.com/${name.toLowerCase().replace(/\s+/g, '-')}/`,
                pageFetched: pageNumber
            });
        }
        return rounds;
    }

    private async scrapePage(pageNumber: number = 1): Promise<IcoDropsRaise[]> {
        console.log(`\n[ICO Drops] Scraping page ${pageNumber}...`);
        const url = pageNumber === 1 ? `${this.baseUrl}?paginate=100` : `${this.baseUrl}?page=${pageNumber}&paginate=100`;
        console.log('  → Step 1: Using AI schema to extract core data...');
        const schema = {
            type: "object",
            properties: {
                funding_rounds: {
                    type: "array",
                    description: "Extract ALL funding rounds on the page (should be ~100 with paginate=100 parameter)",
                    items: {
                        type: "object",
                        properties: {
                            project_name: { type: "string" },
                            round_type: { type: "string" },
                            amount_raised: { type: "string" },
                            date: { type: "string" },
                            category: { type: "string" }
                        }
                    }
                }
            }
        };
        const firecrawl = (this.scraper as any).client;
        const result = await withRateLimitRetry<any>(() => firecrawl.scrape(url, {formats: ['html', { type: 'json', schema }], actions: [{ type: 'wait', milliseconds: 2000 }]}), 5, `ICO Drops page ${pageNumber}`);
        if (!result.json || !result.json.funding_rounds) {throw new Error(`Schema extraction returned no data for page ${pageNumber}`);}
        const rawRounds = result.json.funding_rounds;
        console.log(`  ✓ Extracted ${rawRounds.length} rounds with AI`);
        console.log('  → Step 2: Extracting investors from HTML tooltips...');
        const cheerio = require('cheerio');
        const $ = cheerio.load(result.html || '');
        const investorsByProject = new Map<string, string[]>();
        $('li.Tbl-Row').each((_: any, row: any) => {
            const projectName = $(row).find('.Cll-Project__name').text().trim();
            if (projectName) {
                const investors: string[] = [];
                $(row).find('.Stacked-Images__item[data-tooltip-text]').each((_idx: any, investorEl: any) => {
                    const investorName = $(investorEl).attr('data-tooltip-text');
                    if (investorName && 
                        !investorName.includes('Details') && 
                        !investorName.includes('traded on') && 
                        !investorName.includes('added in the last') &&
                        !investorName.includes('More Details') &&
                        !/^\+\d+$/.test(investorName.trim()) &&
                        !investors.includes(investorName)) {
                        investors.push(investorName);
                    }
                });
                if (investors.length > 0) {investorsByProject.set(projectName, investors);}
            }
        });
        console.log(`  ✓ Found investors for ${investorsByProject.size} projects`);
        const rounds: IcoDropsRaise[] = rawRounds.map((r: any) => {
            const projectName = r.project_name || '';
            const investors = investorsByProject.get(projectName) || [];
            return {
                name: projectName,
                round: r.round_type || '',
                amount: parseAmount(r.amount_raised || ''),
                valuation: null,
                date: r.date || '',
                category: r.category || '',
                investors: investors,
                ecosystem: [],
                link: `https://icodrops.com/${projectName.toLowerCase().replace(/\s+/g, '-')}/`,
                pageFetched: pageNumber
            };
        });
        return rounds;
    }

    private async hasMorePages(pageNumber: number): Promise<boolean> {if (this.config.maxPages && pageNumber >= this.config.maxPages) {return false;} return true;}

    async scrapeAll(): Promise<IcoDropsRaise[]> {
        console.log(`Backfill: ${this.config.backfillEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Max pages: ${this.config.maxPages || 'unlimited'}\n`);
        const allRounds: IcoDropsRaise[] = [];
        let currentPage = 1;
        let hasMore = true;
        while (hasMore) {
            try {
                const rounds = await this.scrapePage(currentPage);
                if (rounds.length === 0) {console.log(`  ℹ No rounds found on page ${currentPage}, stopping.`); break;}
                allRounds.push(...rounds);
                console.log(`  ✓ Total rounds so far: ${allRounds.length}`);
                if (!this.config.backfillEnabled) {console.log('\n  ℹ Backfill disabled, stopping after first page.'); break;}
                hasMore = await this.hasMorePages(currentPage);
                if (hasMore && rounds.length < 20) {console.log(`  ℹ Got ${rounds.length} rounds (less than typical page size), likely last page.`); hasMore = false;}
                if (hasMore) {currentPage++; console.log(`Waiting 6s before next page...`); await rateLimitDelay(6000);}
            } 
            catch (error: any) {console.error(`  ✗ Error on page ${currentPage}:`, error.message); break;}
        }
        console.log(`\nScraping complete! Total rounds: ${allRounds.length}`);
        return allRounds;
    }

    async scrapeAndSave(): Promise<string> {
        const rounds = await this.scrapeAll();
        const outputDir = this.config.outputDir || path.join(process.cwd(), 'data');
        if (!fs.existsSync(outputDir)) {fs.mkdirSync(outputDir, { recursive: true });}
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `icodrops-${timestamp}.json`;
        const filepath = path.join(outputDir, filename);
        const data = {
            source: 'ICO Drops',
            url: this.baseUrl,
            scrapedAt: new Date().toISOString(),
            totalRounds: rounds.length,
            backfillEnabled: this.config.backfillEnabled || false,
            rounds: rounds
        };
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`\nSaved ${rounds.length} rounds to: ${filepath}\n`);
        return filepath;
    }

    getSummary(rounds: IcoDropsRaise[]) {
        const roundTypes = rounds.reduce((acc: any, r) => {acc[r.round] = (acc[r.round] || 0) + 1; return acc;}, {});
        const categories = rounds.reduce((acc: any, r) => {if (r.category) acc[r.category] = (acc[r.category] || 0) + 1; return acc;}, {});
        const withAmount = rounds.filter(r => r.amount !== null).length;
        const withValuation = rounds.filter(r => r.valuation !== null).length;
        const withInvestors = rounds.filter(r => r.investors.length > 0).length;
        return {
            total: rounds.length,
            withAmount: `${withAmount} (${Math.round(withAmount/rounds.length*100)}%)`,
            withValuation: `${withValuation} (${Math.round(withValuation/rounds.length*100)}%)`,
            withInvestors: `${withInvestors} (${Math.round(withInvestors/rounds.length*100)}%)`,
            avgInvestorsPerRound: withInvestors > 0  ? (rounds.reduce((sum, r) => sum + r.investors.length, 0) / withInvestors).toFixed(1) : '0',
            roundTypes,
            categories
        };
    }
}