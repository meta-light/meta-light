/* Local metering for a 24/7 bot on a metered key.
 *
 * The API publishes no rate-limit headers, so we cannot discover our own
 * usage - we have to remember it. Budget wraps `fetch`, counts every request
 * before it leaves, and persists the ledger to usage.json so a restart (or a
 * crash loop) cannot double-spend the month.
 *
 * Three independent budgets, in order of scarcity:
 *
 *   25 wallet resolutions / month  - only `GET /v2/users/{handle}` spends one,
 *                                    and only for a handle not already spent
 *                                    this month. Refused locally when gone.
 *   60 requests / minute           - a sliding window; we pace, not fail.
 *   10K requests / month           - a hard stop with 200 held in reserve.
 *
 *   npx tsx src/budget.ts          # print the ledger
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { PLAN, RESERVE, USAGE_FILE } from "./config.ts";
import type { FetchLike } from "./fomo.ts";

/** Thrown instead of sending a request that would breach a quota. Nothing is
 * spent when this fires - it is the one error that costs nothing. */
export class BudgetError extends Error {
  readonly kind: "month" | "wallet";
  constructor(kind: "month" | "wallet", message: string) {
    super(message);
    this.name = "BudgetError";
    this.kind = kind;
  }
}

interface Ledger {
  /** `YYYY-MM` in UTC; a change resets the monthly counters. */
  month: string;
  requests: number;
  /** Handles whose wallets we have already paid to resolve this month. */
  resolutions: string[];
  /** Set when the API tells us the wallet quota is gone, which can happen
   * before our own count reaches 25 (usage predating this ledger). */
  walletsExhausted: boolean;
  /** Every request we have refused, by kind, for the boot report. */
  refused: Record<string, number>;
  updatedAt: string;
}

const utcMonth = (at = new Date()): string => at.toISOString().slice(0, 7);

const EMPTY = (): Ledger => ({
  month: utcMonth(),
  requests: 0,
  resolutions: [],
  walletsExhausted: false,
  refused: {},
  updatedAt: new Date().toISOString(),
});

/** `/v2/users/{handle}` and nothing else - `/trades` and `/balances` are
 * served from captured data and cost no resolution (verified against the live
 * API with the quota already exhausted). */
export function walletResolutionHandle(url: string): string | undefined {
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, "").split("?")[0] ?? "";
  const match = /^\/v\d+\/users\/([^/]+)\/?$/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : undefined;
}

export interface BudgetOptions {
  file?: string;
  /** Skip persistence - for tests. */
  memoryOnly?: boolean;
  now?: () => number;
}

export class Budget {
  private readonly file: string;
  private readonly memoryOnly: boolean;
  private readonly now: () => number;
  private ledger: Ledger;
  /** Sliding one-minute window of request timestamps. Not persisted: a
   * restart takes longer than the window it would protect. */
  private readonly minute: number[] = [];

  constructor(options: BudgetOptions = {}) {
    this.file = options.file ?? USAGE_FILE;
    this.memoryOnly = options.memoryOnly ?? false;
    this.now = options.now ?? Date.now;
    this.ledger = this.memoryOnly ? EMPTY() : this.load();
  }

  private load(): Ledger {
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Ledger>;
      return {
        ...EMPTY(),
        ...parsed,
        resolutions: (parsed.resolutions ?? []).map((handle) => handle.toLowerCase()),
        refused: parsed.refused ?? {},
      };
    } catch {
      // No ledger yet, or an unreadable one: start clean rather than refuse to
      // boot. The worst case is one month counted from zero.
      return EMPTY();
    }
  }

  private save(): void {
    if (this.memoryOnly) return;
    this.ledger.updatedAt = new Date(this.now()).toISOString();
    const directory = dirname(this.file);
    if (directory && directory !== ".") mkdirSync(directory, { recursive: true });
    // Write-then-rename, so a kill mid-write cannot leave a truncated ledger.
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.ledger, undefined, 2)}\n`);
    renameSync(temporary, this.file);
  }

  /** Month boundaries reset requests and resolutions together, including the
   * exhausted flag - the API's quota rolls on the same calendar. */
  private roll(): void {
    const month = utcMonth(new Date(this.now()));
    if (month === this.ledger.month) return;
    this.ledger = { ...EMPTY(), month, refused: {} };
    this.save();
  }

  private refuse(kind: "month" | "wallet", message: string): never {
    this.ledger.refused[kind] = (this.ledger.refused[kind] ?? 0) + 1;
    this.save();
    throw new BudgetError(kind, message);
  }

  get monthlyRemaining(): number {
    this.roll();
    return Math.max(0, PLAN.requestsPerMonth - RESERVE.requestsPerMonth - this.ledger.requests);
  }

  get walletsRemaining(): number {
    this.roll();
    if (this.ledger.walletsExhausted) return 0;
    return Math.max(0, PLAN.walletResolutionsPerMonth - this.ledger.resolutions.length);
  }

  /** True when this handle's wallets are already paid for this month, so
   * re-resolving it is free. */
  resolved(handle: string): boolean {
    this.roll();
    return this.ledger.resolutions.includes(handle.toLowerCase());
  }

  snapshot(): {
    month: string;
    requests: number;
    requestsRemaining: number;
    wallets: number;
    walletsRemaining: number;
    walletsExhausted: boolean;
    refused: Record<string, number>;
  } {
    this.roll();
    return {
      month: this.ledger.month,
      requests: this.ledger.requests,
      requestsRemaining: this.monthlyRemaining,
      wallets: this.ledger.resolutions.length,
      walletsRemaining: this.walletsRemaining,
      walletsExhausted: this.ledger.walletsExhausted,
      refused: { ...this.ledger.refused },
    };
  }

  /** Sleep just long enough that this request lands inside the per-minute
   * allowance. Pacing, not failing: a slow boot beats a 429. */
  private async pace(): Promise<void> {
    const ceiling = PLAN.requestsPerMinute - RESERVE.requestsPerMinute;
    for (;;) {
      const cutoff = this.now() - 60_000;
      while (this.minute.length > 0 && (this.minute[0] as number) <= cutoff) this.minute.shift();
      if (this.minute.length < ceiling) return;
      const oldest = this.minute[0] as number;
      // Poll in short hops rather than committing to one long sleep: the wall
      // clock can jump, and a caller that aborts should not be stuck for a
      // full minute waiting on a window that already cleared.
      await new Promise((resolve) => setTimeout(resolve, Math.min(500, Math.max(25, oldest - cutoff))));
    }
  }

  /** Wrap a fetch so every call through it is metered. The client takes this
   * as its `fetch` option, which puts retries under the budget too. */
  wrap(inner: FetchLike): FetchLike {
    return async (url, init) => {
      this.roll();
      const handle = walletResolutionHandle(url);
      const fresh = handle !== undefined && !this.resolved(handle);

      if (this.monthlyRemaining <= 0) {
        this.refuse(
          "month",
          `Monthly request budget spent (${this.ledger.requests}/${PLAN.requestsPerMonth} in ${this.ledger.month}, ` +
            `${RESERVE.requestsPerMonth} held in reserve). Resets on the 1st UTC.`,
        );
      }
      if (fresh && this.walletsRemaining <= 0) {
        this.refuse(
          "wallet",
          `Wallet resolutions spent (${this.ledger.resolutions.length}/${PLAN.walletResolutionsPerMonth} in ` +
            `${this.ledger.month}). Refusing to resolve @${handle} - it would 429 anyway. ` +
            `Cached traders still work; the stream is unaffected.`,
        );
      }

      await this.pace();
      this.minute.push(this.now());
      this.ledger.requests += 1;
      if (fresh && handle) this.ledger.resolutions.push(handle);
      this.save();

      const response = await inner(url, init);

      // The API is the authority on the wallet quota; believe it over our count.
      if (response.status === 429 && handle) {
        const copy = response.clone();
        const body: unknown = await copy.json().catch(() => undefined);
        const error = typeof body === "object" && body !== null ? (body as Record<string, unknown>)["error"] : undefined;
        if (typeof error === "string" && error.includes("wallet resolution")) {
          this.ledger.walletsExhausted = true;
          // A refused resolution was not actually granted - take it back.
          if (fresh) this.ledger.resolutions = this.ledger.resolutions.filter((h) => h !== handle);
          this.save();
        }
      }
      return response;
    };
  }
}

/** The metered fetch every entry point should hand to FomoClient. */
export function governedFetch(budget: Budget): FetchLike {
  const inner = globalThis.fetch as FetchLike | undefined;
  if (!inner) throw new Error("No global fetch - run on Node 18+");
  return budget.wrap(inner);
}

export function formatBudget(budget: Budget): string {
  const { month, requests, requestsRemaining, wallets, walletsRemaining, walletsExhausted } = budget.snapshot();
  const walletLine = walletsExhausted
    ? `${PLAN.walletResolutionsPerMonth}/${PLAN.walletResolutionsPerMonth} spent (API says exhausted)`
    : `${wallets}/${PLAN.walletResolutionsPerMonth} spent, ${walletsRemaining} left`;
  return (
    `budget ${month}: requests ${requests}/${PLAN.requestsPerMonth} (${requestsRemaining} usable) | ` +
    `wallet resolutions ${walletLine}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const budget = new Budget();
  console.log(formatBudget(budget));
  const { refused } = budget.snapshot();
  const entries = Object.entries(refused);
  if (entries.length > 0) {
    console.log(`refused this month: ${entries.map(([kind, count]) => `${kind} ${count}`).join(", ")}`);
  }
  console.log(`\nledger: ${USAGE_FILE} (delete it to start the month's count over)`);
}
