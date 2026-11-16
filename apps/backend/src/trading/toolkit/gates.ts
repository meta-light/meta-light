export type Gate<T> = readonly [name: string, pass: (c: T) => boolean];

export class GateLog {
  readonly rejected = new Map<string, number>();
  passed = 0;

  filter<T>(candidates: readonly T[], gates: readonly Gate<T>[]): T[] {
    return candidates.filter((c) => {
      for (const [name, pass] of gates) {
        if (!pass(c)) {
          this.rejected.set(name, (this.rejected.get(name) ?? 0) + 1);
          return false;
        }
      }
      this.passed++;
      return true;
    });
  }

  reject(name: string, n = 1): void {
    this.rejected.set(name, (this.rejected.get(name) ?? 0) + n);
  }

  summary(): Record<string, number> {
    return { passed: this.passed, ...Object.fromEntries(this.rejected) };
  }
}

export interface QuoteLike {
  t: number;
  bid: number | null;
  ask: number | null;
  depth?: number | null;
}

export interface QuoteLimits {
  maxAgeMs?: number;
  maxSpread?: number;
  minDepth?: number;
}

export function quoteGates<T>(quote: (c: T) => QuoteLike, now: (c: T) => number, limits: QuoteLimits): Gate<T>[] {
  const gates: Gate<T>[] = [
    ['quote:two-sided', (c) => quote(c).bid != null && quote(c).ask != null],
  ];
  if (limits.maxAgeMs != null) gates.push(['quote:stale', (c) => now(c) - quote(c).t <= limits.maxAgeMs!]);
  if (limits.maxSpread != null) gates.push(['quote:spread', (c) => quote(c).ask! - quote(c).bid! <= limits.maxSpread!]);
  if (limits.minDepth != null) gates.push(['quote:depth', (c) => (quote(c).depth ?? 0) >= limits.minDepth!]);
  return gates;
}
