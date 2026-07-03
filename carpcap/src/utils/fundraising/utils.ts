import { LlamaRaise, DecentralisedCoRaise, IcoDropsRaise, CryptoRankRaise, UnifiedRaise } from './types';

export function normalizeLlama(raise: LlamaRaise) {
    return {
        date: new Date(raise.date * 1000).toISOString().split('T')[0],
        project_name: raise.name,
        sector: raise.categoryGroup || '',
        subsector: raise.category || '',
        round_type: "Fundraise",
        round: raise.round,
        amount: raise.amount ? raise.amount * 1000000 : null,
        valuation: raise.valuation ? raise.valuation * 1000000 : null,
        ecosystem: raise.chains.join(', '),
        investors: [...raise.leadInvestors, ...raise.otherInvestors].join(', ')
    };
}

export function normalizeDCo(raise: DecentralisedCoRaise) {
    const investors = (raise.investorIdentifiers || []).map(i => i.name).join(', ');
    const ecosystem = raise.cryptoChain || '';
    const sector = (raise.fundedOrganizationCategories || []).map(c => c.value).join(', ');
    return {
        date: raise.announcedOn ? raise.announcedOn.split('T')[0] : '',
        project_name: raise.name,
        sector: sector,
        subsector: raise.secondaryCryptoCategory || '',
        round_type: raise.investmentType,
        round: raise.investmentStage,
        amount: raise.moneyRaised?.valueUsd || null,
        valuation: null,
        ecosystem: ecosystem,
        investors: investors
    };
}

export function normalizeIcoDrops(raise: IcoDropsRaise) {
    const parseDate = (str: string) => {
        if (!str) return '';
        const d = new Date(str);
        return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
    };
    return {
        date: parseDate(raise.date),
        project_name: raise.name,
        sector: raise.category,
        subsector: '', 
        round_type: "Fundraise", 
        round: raise.round,
        amount: raise.amount,
        valuation: raise.valuation,
        ecosystem: raise.ecosystem.join(', '),
        investors: raise.investors.join(', ')
    };
}

export function normalizeCryptoRank(raise: CryptoRankRaise) {
    const parseDate = (str: string) => {
        if (!str) return '';
        const d = new Date(str);
        return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
    };
    return {
        date: parseDate(raise.date),
        project_name: raise.name,
        sector: raise.category,
        subsector: '',
        round_type: "Fundraise",
        round: raise.round,
        amount: raise.amount,
        valuation: raise.valuation,
        ecosystem: raise.blockchain.join(', '),
        investors: raise.investors.join(', ')
    };
}

export function cleanName(name: string): string {return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');}

export function areDatesClose(d1: string, d2: string): boolean {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return false;
    const diff = Math.abs(t1 - t2);
    const day = 1000 * 60 * 60 * 24;
    return diff <= 10 * day;
}

export function areAmountsSimilar(a1: number | null, a2: number | null): boolean {
    if (a1 === null && a2 === null) return true;
    if (a1 === null || a2 === null) return false;
    const diff = Math.abs(a1 - a2);
    const avg = (a1 + a2) / 2;
    return diff / avg <= 0.1;
}

export function normalizeRoundType(roundType: string): string {
    const normalized = roundType.toLowerCase().trim();
    if (normalized.includes('m&a') || normalized.includes('merger') || normalized.includes('acquisition')) {return 'm&a';}
    if (normalized.includes('debt')) {return 'debt';}
    return 'fundraise';
}

export function parseAmount(str: string): number | null {
    if (!str || str === '—' || str.toLowerCase() === 'tba') return null;
    const clean = str.replace(/[$,]/g, '').trim();
    let mult = 1;
    if (clean.endsWith('M')) {mult = 1000000;} 
    else if (clean.endsWith('K')) {mult = 1000;} 
    else if (clean.endsWith('B')) {mult = 1000000000;}
    const num = parseFloat(clean.replace(/[MKB]/g, ''));
    return isNaN(num) ? null : num * mult;
}

export function recordsMatch(r1: UnifiedRaise, r2: UnifiedRaise): boolean {
    const name1 = cleanName(r1.project_name);
    const name2 = cleanName(r2.project_name);
    if (name1 !== name2) return false;
    if (!areDatesClose(r1.date, r2.date)) return false;
    if (!areAmountsSimilar(r1.amount, r2.amount)) return false;
    return true;
}