// @meta-light/utils — shared utilities for the monorepo.
// This is a "just-in-time" package: apps import the TypeScript source directly
// (no build step). Next.js apps must list it in `transpilePackages`; Bun/tsx
// consume the .ts natively. Add new modules here and re-export them below.

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
