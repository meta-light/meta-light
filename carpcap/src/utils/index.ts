function parseFromMatch(match: RegExpMatchArray): number | null {
    const numStr = match[1].replace(/,/g, '');
    const num = parseFloat(numStr);
    if (Number.isNaN(num) || num < 0) return null;
    const suffix = (match[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'b' || suffix === 'billion' || suffix === 'billions') mult = 1e9;
    else if (suffix === 'm' || suffix === 'million' || suffix === 'millions') mult = 1e6;
    else if (suffix === 'k' || suffix === 'thousand') mult = 1e3;
    const dollars = Math.round(num * mult);
    return dollars > 0 ? dollars : null;
}

function parseNumAndSuffix(numStr: string, suffix: string): number | null {return parseFromMatch(['', numStr, suffix] as unknown as RegExpMatchArray);}
const CLEAN_USD_REGEX = /^(?:US\s*\$?\s*|\$\s*)([\d,.]+)\s*(million|millions|m|billion|billions|b|k|thousand)?\s*$/i;
const FIRST_USD_REGEX = /(?:US\s*\$?\s*|\$\s*)([\d,.]+)\s*(million|millions|m|billion|billions|b|k|thousand)?/i;

export function parseAmountToUsd(str: string | undefined | null): number | null {
    if (str == null || typeof str !== 'string') return null;
    let s = str.trim();
    if (!s) return null;
    if (/^[\d,]+$/.test(s)) {const num = parseInt(s.replace(/,/g, ''), 10); return Number.isNaN(num) || num <= 0 ? null : num;}
    if (/^[~≈]/.test(s) || /^>\s*\$/.test(s) || /\+\s*$/.test(s)) return null;
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    const totalMatch = s.match(/\btotal\s+\$([\d,.]+)\s*(M|B|K|million|billion)?/i);
    if (totalMatch) {const n = parseFromMatch(totalMatch); if (n !== null) return n;}
    if (/[\d,]+\s*-\s*[\d,]+\s*(million|millions|m|billion|billions|b|k|thousand)?\s*$/i.test(s)) return null;
    const usdMatch = s.match(/^\s*USD\s*\$?\s*([\d,.]+)\s*(million|millions|m|billion|billions|b|k|thousand)?\s*$/i);
    if (usdMatch) {const n = parseNumAndSuffix(usdMatch[1], usdMatch[2] ?? ''); if (n !== null) return n;}
    if (/\b(estimated|approx\.?)\b/i.test(lower)) return null;
    if (/\b(over|nearly|almost)\s+\$/i.test(lower)) return null;
    if (/\b(undisclosed|conversion|equivalent|reported equivalent|seven-figure|nine-figure|eight-figure|multi-million|multi-billion)\b/i.test(lower)) return null;
    if (/\s+or\s+/.test(lower)) return null;
    if (/\b(btc|eth|chf|eur|€|sek|gbp|jpy|¥|₦|tokens?|pti|s\$|aud|cad|c\$)\b/i.test(lower)) return null;
    if (/^\s*[€¥]/.test(s)) return null;
    if (/^\d+([,.]\d+)*\s*(eth|btc|chf|eur|sek|€|¥|₦)/i.test(lower)) return null;
    if (/\b(equity|convertible|notes)\s+and\s+\$/.test(lower)) return null;
    if (/\$\s*[\d,.]+[MBK]?\s+and\s+\$/.test(s)) return null;
    if (/[€¥]/.test(str)) return null;
    let match = s.match(CLEAN_USD_REGEX);
    if (match) return parseFromMatch(match);
    match = s.match(FIRST_USD_REGEX);
    if (match && match.index === 0) {const rest = s.slice(match[0].length).trim(); if (rest.length === 0) return parseFromMatch(match);}
    return null;
}

export function formatAmountUsd(amountUsd: number | null | undefined): string {
    if (amountUsd == null || amountUsd <= 0) return '';
    if (amountUsd >= 1e9) return `$${(amountUsd / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (amountUsd >= 1e6) return `$${(amountUsd / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (amountUsd >= 1e3) return `$${(amountUsd / 1e3).toFixed(0)}K`;
    return `$${amountUsd}`;
}

export function amountsEqual(a: number | null, b: number | null): boolean {
    if (a == null || b == null) return a === b;
    if (a === b) return true;
    const max = Math.max(a, b);
    return Math.abs(a - b) / max <= 0.05;
}

export function normalizeToken(value?: string): string {
    if (!value) return "";
    const raw = value.trim();
    const pairMatch = raw.match(/^(?:connect|substack)\.sid=([^;]+)$/i);
    if (pairMatch?.[1]) return pairMatch[1].trim();
    const headerMatch = raw.match(/(?:^|;\s*)(?:connect|substack)\.sid=([^;]+)/i);
    if (headerMatch?.[1]) return headerMatch[1].trim();
    return raw;
}

export function normalizeHostname(value?: string): string {
    if (!value) return "substack.com";
    return value.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

export function normalizeSlug(value?: string): string {
    if (!value) return "";
    const trimmed = value.trim();
    try {
        if (/^https?:\/\//i.test(trimmed)) {
            const url = new URL(trimmed);
            const host = url.hostname.toLowerCase();
            if (host === 'substack.com' || host === 'www.substack.com') {
                const handleMatch = url.pathname.match(/^\/@([^/?#]+)/i);
                if (handleMatch?.[1]) return handleMatch[1];
            }
            if (host.endsWith('.substack.com')) {
                const subdomain = host.slice(0, -'.substack.com'.length);
                if (subdomain && subdomain !== 'www') return subdomain;
            }
        }
    } catch {
        // fall through to string normalization
    }
    return trimmed.replace(/^@/, "");
}

export function  toNullableFiniteNumber(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseDateSafe(value: any): Date {
    if (value == null) return new Date();
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
}