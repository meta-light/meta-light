/* Who we are and what the plan allows.
 *
 * FOMO sends no `x-ratelimit-*` headers, so these numbers are the only budget
 * we have: everything is metered locally in usage.json (see budget.ts). */

/** Your FOMO handle. Used to exclude yourself from the copy list - copying
 * your own fills is a feedback loop, not a strategy. */
export const MY_HANDLE = "0xMetaLight";

/* The accounts you follow on FOMO, hardcoded.
 *
 * Not a choice about caching: FOMO's API has no follow graph. There is no
 * endpoint that answers "who does @0xMetaLight follow" - a trader carries a
 * `followers` count and no `following` list, and `/v2/users/me` is read as the
 * literal handle `me`. So the roster crosses over from the app by hand.
 *
 * Edit this list to change who is watched. follows.json, if it exists, layers
 * per-trader copy settings (weight, caps, mute) on top without duplicating the
 * roster - see followRoster() in follows.ts. */
export const FOLLOWING: readonly string[] = [
  "JamesChristoph", // James Christoph
  "fejau_inc", //      fejau
  "AvgJoesCrypto", //  AJC
  "smyyguy", //        Dan Smith
  "EffortCapital", //  David
  "WestieCapital", //  Westie (rev/acc)
];

/** Free-plan quotas, as published on the dashboard. */
export const PLAN = {
  requestsPerMonth: 10_000,
  requestsPerMinute: 60,
  /** handle -> wallet lookups, i.e. `GET /v2/users/{handle}`. The scarcest
   * resource by three orders of magnitude, and it never resets mid-month. */
  walletResolutionsPerMonth: 25,
} as const;

/** Headroom kept in reserve so a burst can never trip the real limit:
 * we stop at 9800/month and pace to 50/minute. */
export const RESERVE = {
  requestsPerMonth: 200,
  requestsPerMinute: 10,
} as const;

export const USAGE_FILE = "usage.json";
export const TRADER_CACHE_FILE = "cache/traders.json";
