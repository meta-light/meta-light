// @meta-light/utils — shared utilities for the monorepo.
// This is a "just-in-time" package: apps import the TypeScript source directly
// (no build step). Next.js apps must list it in `transpilePackages`; Bun/tsx
// consume the .ts natively. Add new modules here and re-export them below.
//
// Keep this entry browser-safe: no `node:*` imports. Node-only code lives in
// its own subpath export (see package.json "exports"), e.g.
// `@meta-light/utils/node`, `@meta-light/utils/coingecko`.

/** A report record as returned by an Algolia search index. */
export type AlgoliaRecord = {
  objectID: string;
  id?: number;
  title: string;
  content?: string;
  _highlightResult?: unknown;
};

/** An Algolia report record without its body and search highlights. */
export type ReportMetadata = Omit<AlgoliaRecord, "content" | "_highlightResult">;

/** Pause execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number to the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Shorten a wallet/transaction address for display, e.g.
 * `truncateAddress("So11111111111111111111111111111111111111112")` → `So11…1112`.
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Format a number as USD, e.g. `formatUsd(1234.5)` → `$1,234.50`. */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function sanitizeSegment(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return ascii.slice(0, 80) || 'untitled-report';
}

export function reportStableId(report: AlgoliaRecord): string {
  if (Number.isFinite(report.id)) {
    return String(report.id);
  }
  return report.objectID;
}

export function folderNameForReport(report: AlgoliaRecord): string {
  return `${sanitizeSegment(report.title)}-${reportStableId(report)}`;
}

export function toMetadata(report: AlgoliaRecord): ReportMetadata {
  const { content: _content, _highlightResult: _highlightResult, ...metadata } = report;
  return metadata;
}

export function slugify_url(url: string, max_length: number = 100): string {
  let host = "";
  let pathname = "";

  try {
    const parsed = new URL(url);
    host = parsed.host;
    pathname = parsed.pathname;
  } catch {
    const noScheme = url.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "");
    const slashIndex = noScheme.indexOf("/");
    if (slashIndex >= 0) {
      host = noScheme.slice(0, slashIndex);
      pathname = noScheme.slice(slashIndex);
    } else {
      pathname = noScheme;
    }
  }

  const slug = `${host}${pathname}`
    .replaceAll("/", "_")
    .replace(/^_+|_+$/g, "")
    .replace(/[^\w\-_]/g, "");

  return slug.slice(0, max_length) || "page";
}

export function utc_today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utc_now_iso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

