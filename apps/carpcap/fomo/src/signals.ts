/**
 * The signal engine: FOMO alerts in, copy-trade decisions out.
 *
 * This is the FOMO half of the bot. It never touches a chain - it turns the
 * activity firehose into `CopySignal`s that an executor can act on, and records
 * exactly why every other alert was dropped. Keeping the decision layer pure
 * means the risk rules are testable without an RPC, a wallet, or real money.
 *
 *   alert -> gates -> sizing -> CopySignal -> (executor, later)
 */
import { alertKind, chainId as toChainId, chainName, normalizeChain } from "./fomo.ts";
import type { Alert } from "./fomo.ts";
import { followIndex, normalizeHandle } from "./follows.ts";
import type { Follow } from "./follows.ts";

/** A decision to mirror a followed trader's entry or exit. */
export interface CopySignal {
  /** Alert id this came from - the executor's idempotency key. */
  id: string;
  eventId?: string;
  side: "buy" | "sell";
  /** Handle as FOMO spells it. */
  trader: string;
  /** The follow row that matched, for the executor's own rules. */
  follow: Follow;
  token: string;
  tokenAddress: string;
  chain: string;
  chainId: number;
  /** When the trader traded (unix millis). */
  ts: number;
  /** How stale the signal was when we decided. The delayed feed makes this
   * 60s+, which is the difference between copy trading and paying the exit. */
  ageMs: number;
  /** Their size, when the alert reports it. */
  traderUsd?: number;
  /** What we would spend, after weights and caps. A sell is a full exit of the
   * position this bot opened, so `usd` is what we put in. */
  usd: number;
  /** Human-readable sizing rationale, e.g. `"base 50 x weight 2"`. */
  sizing: string;
  source: string;
  text?: string;
}

/** Why an alert did not become a signal. Every alert produces a signal or one
 * of these - there is no silent drop. */
export type SkipReason =
  | "replay"
  | "not-a-trade"
  | "not-followed"
  | "muted"
  | "no-token-address"
  | "chain-not-allowed"
  | "stale"
  | "duplicate"
  | "cooldown"
  | "no-position"
  | "daily-cap"
  | "size-too-small";

export interface Skip {
  reason: SkipReason;
  alert: Alert;
  /** Extra context, e.g. `"aged 92s > 45s"`. */
  detail?: string;
}

export interface EngineConfig {
  /** Base position size in USD before a follow's weight. */
  baseUsd: number;
  /** Ceiling per signal, after weighting. */
  maxUsd: number;
  /** Floor - below this, fees make the copy pointless. */
  minUsd: number;
  /** Total USD of entries per UTC day. */
  dailyUsdCap: number;
  /** Chains we can actually execute on. An alert on anything else is dropped. */
  chains: string[];
  /** Refuse signals older than this. The 60s-delayed feed will trip it. */
  maxAgeMs: number;
  /** Ignore repeat entries on the same trader+token inside this window. */
  cooldownMs: number;
  /** Copy `push` alerts too. They duplicate the feed, so off by default. */
  includePush: boolean;
  /** Cap on remembered alert ids - dedupe memory, not a position ledger. */
  seenLimit: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  baseUsd: 50,
  maxUsd: 250,
  minUsd: 10,
  dailyUsdCap: 1000,
  chains: ["robinhood", "solana", "base", "bsc", "ethereum"],
  maxAgeMs: 45_000,
  cooldownMs: 5 * 60_000,
  includePush: false,
  seenLimit: 5_000,
};

/** An entry this bot decided to open, held until the trader exits. */
export interface Position {
  token: string;
  tokenAddress: string;
  chain: string;
  trader: string;
  usd: number;
  openedAt: number;
  signals: number;
}

export interface EngineEvents {
  signal: (signal: CopySignal) => void;
  skip: (skip: Skip) => void;
}

export class SignalEngine {
  readonly config: EngineConfig;

  private follows: Map<string, Follow>;
  private readonly seen = new Set<string>();
  private readonly cooldowns = new Map<string, number>();
  /** Keyed `chain:tokenAddress` - what we are holding from a copy. */
  private readonly positions = new Map<string, Position>();
  private readonly listeners: { [K in keyof EngineEvents]: Set<EngineEvents[K]> } = {
    signal: new Set(),
    skip: new Set(),
  };

  private day = utcDay(Date.now());
  private spentToday = 0;

  constructor(follows: Follow[], config: Partial<EngineConfig> = {}) {
    this.follows = followIndex(follows);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Swap in a new follow list without restarting the bot. */
  setFollows(follows: Follow[]): void {
    this.follows = followIndex(follows);
  }

  get openPositions(): Position[] {
    return [...this.positions.values()];
  }

  /** USD of entries opened so far today, and what is left of the cap. */
  get budget(): { spent: number; remaining: number } {
    return this.budgetAt(Date.now());
  }

  /** The budget as of a given moment, rolling the day over if it has passed.
   * Takes an explicit clock so a backtest is not at the mercy of the wall one. */
  budgetAt(now: number): { spent: number; remaining: number } {
    this.rollDay(now);
    return { spent: this.spentToday, remaining: Math.max(0, this.config.dailyUsdCap - this.spentToday) };
  }

  /** Run one alert through every gate. Returns the signal, or null after
   * emitting a `skip` explaining itself. */
  handle(alert: Alert, now = Date.now()): CopySignal | null {
    this.rollDay(now);

    const skip = (reason: SkipReason, detail?: string): null => {
      this.emit("skip", { reason, alert, ...(detail ? { detail } : {}) });
      return null;
    };

    // 1. The backlog the socket replays on connect is history, not opportunity.
    if (alert.replay) return skip("replay");

    // 2. Only entries and exits are actionable; a thesis is context.
    // `alertKind` widens to string for forward compatibility; narrow it here so
    // the rest of the gate chain works on a real union.
    const kind = alertKind(alert);
    const side: "buy" | "sell" | null = kind === "buy" ? "buy" : kind === "sell" ? "sell" : null;
    if (!side) return skip("not-a-trade", kind ?? "unknown");
    if (!this.config.includePush && alert.source === "push") return skip("not-a-trade", "push duplicate");

    // 3. Is this someone we follow?
    const handle = alert.trader ? normalizeHandle(alert.trader) : "";
    const follow = this.follows.get(handle);
    if (!follow) return skip("not-followed", alert.trader ?? "unknown");
    if (follow.mute) return skip("muted", follow.handle);

    // 4. An executor needs a contract address and a chain, not a ticker.
    const tokenAddress = alert.tokenAddress?.trim();
    if (!tokenAddress) return skip("no-token-address", alert.token ?? "?");
    // Alerts carry the id, the name, or both. Resolve to the canonical pair so
    // the allowlist can be written either way.
    const chainId = alert.chainId ?? (alert.chain ? toChainId(alert.chain) : undefined);
    const chain =
      (chainId ? chainName(chainId) : undefined) ??
      (alert.chain ? normalizeChain(alert.chain) : undefined);
    if (!chain || !chainId) return skip("chain-not-allowed", alert.chain ?? String(alert.chainId ?? "unknown"));

    const allowed = follow.chains ?? this.config.chains;
    if (!allowed.some((name) => normalizeChain(name) === chain)) return skip("chain-not-allowed", chain);

    // 5. Late is worse than never: on a delayed feed the move is already made.
    const ageMs = Math.max(0, now - alert.ts);
    if (ageMs > this.config.maxAgeMs) {
      return skip("stale", `aged ${Math.round(ageMs / 1000)}s > ${Math.round(this.config.maxAgeMs / 1000)}s`);
    }

    // 6. The same trade reaches us as both a feed row and a push.
    const fingerprint = alert.eventId ?? `${handle}|${side}|${tokenAddress}|${alert.ts}`;
    if (this.seen.has(fingerprint) || this.seen.has(alert.id)) return skip("duplicate", fingerprint);

    const key = `${normalizeChain(chain)}:${tokenAddress.toLowerCase()}`;
    const position = this.positions.get(key);

    const signal: CopySignal = {
      id: alert.id,
      ...(alert.eventId ? { eventId: alert.eventId } : {}),
      side,
      trader: alert.trader ?? follow.handle,
      follow,
      token: alert.token ?? tokenAddress.slice(0, 8),
      tokenAddress,
      chain,
      chainId,
      ts: alert.ts,
      ageMs,
      ...(alert.usdValue === null || alert.usdValue === undefined ? {} : { traderUsd: alert.usdValue }),
      usd: 0,
      sizing: "",
      source: alert.source ?? "feed",
      ...(alert.text ? { text: alert.text } : {}),
    };

    if (side === "sell") {
      // Only mirror an exit we have an entry for - otherwise we would be
      // shorting a token we never bought.
      if (!position) return skip("no-position", signal.token);
      this.remember(fingerprint, alert.id);
      this.positions.delete(key);
      return this.deliver({ ...signal, usd: position.usd, sizing: `exit full position (${position.signals} entry/entries)` });
    }

    // 7. Do not chase a trader who is scaling into the same token all morning.
    const cooldownKey = `${handle}|${key}`;
    const until = this.cooldowns.get(cooldownKey) ?? 0;
    if (now < until) return skip("cooldown", `${Math.round((until - now) / 1000)}s left on ${signal.token}`);

    // 8. Size it.
    const weight = follow.weight ?? 1;
    const wanted = this.config.baseUsd * weight;
    const ceiling = Math.min(this.config.maxUsd, follow.maxUsd ?? Infinity);
    const { remaining } = this.budgetAt(now);
    const usd = Math.min(wanted, ceiling, remaining);

    if (remaining <= 0) return skip("daily-cap", `$${this.config.dailyUsdCap} spent`);
    if (usd < this.config.minUsd) {
      return skip("size-too-small", `$${usd.toFixed(2)} < $${this.config.minUsd}`);
    }

    const capped =
      usd < wanted ? ` capped to $${usd} (${usd === remaining ? "daily budget" : "max"})` : "";
    this.remember(fingerprint, alert.id);
    this.cooldowns.set(cooldownKey, now + this.config.cooldownMs);
    this.spentToday += usd;
    this.positions.set(key, {
      token: signal.token,
      tokenAddress,
      chain,
      trader: signal.trader,
      usd: (position?.usd ?? 0) + usd,
      openedAt: position?.openedAt ?? now,
      signals: (position?.signals ?? 0) + 1,
    });

    return this.deliver({ ...signal, usd, sizing: `base $${this.config.baseUsd} x ${weight}${capped}` });
  }

  on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    this.listeners[event].add(listener);
    return this;
  }

  off<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    this.listeners[event].delete(listener);
    return this;
  }

  private deliver(signal: CopySignal): CopySignal {
    this.emit("signal", signal);
    return signal;
  }

  private remember(...keys: string[]): void {
    for (const key of keys) this.seen.add(key);
    // A Set iterates in insertion order, so the first entries are the oldest.
    while (this.seen.size > this.config.seenLimit) {
      const oldest = this.seen.values().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
  }

  private rollDay(now = Date.now()): void {
    const today = utcDay(now);
    if (today === this.day) return;
    this.day = today;
    this.spentToday = 0;
  }

  private emit<K extends keyof EngineEvents>(event: K, ...args: Parameters<EngineEvents[K]>): void {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: Parameters<EngineEvents[K]>) => void)(...args);
      } catch {
        // A broken log line must not kill the bot mid-signal.
      }
    }
  }
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
