import type { Gate } from './gates';

export class EntryMemory<K = string> {
  private last = new Map<K, { step: number; score: number }>();

  constructor(
    readonly cooldownSteps: number,
    readonly hysteresis: number,
  ) {}

  record(key: K, step: number, score: number): void {
    this.last.set(key, { step, score });
  }

  gates<T>(key: (c: T) => K, step: (c: T) => number, score: (c: T) => number): Gate<T>[] {
    return [
      ['cooldown', (c) => {
        const prev = this.last.get(key(c));
        return !prev || step(c) - prev.step >= this.cooldownSteps;
      }],
      ['hysteresis', (c) => {
        const prev = this.last.get(key(c));
        return !prev || score(c) - prev.score >= this.hysteresis;
      }],
    ];
  }
}

export function topK<T>(candidates: readonly T[], score: (c: T) => number, k: number, open: number, maxOpen: number): T[] {
  const slots = Math.max(0, Math.min(k, maxOpen - open));
  return [...candidates].sort((a, b) => score(b) - score(a)).slice(0, slots);
}

export function topKPerGroup<T>(
  candidates: readonly T[],
  score: (c: T) => number,
  group: (c: T) => string,
  perGroup: number,
): T[] {
  const taken = new Map<string, number>();
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .filter((c) => {
      const g = group(c);
      const n = taken.get(g) ?? 0;
      if (n >= perGroup) return false;
      taken.set(g, n + 1);
      return true;
    });
}
