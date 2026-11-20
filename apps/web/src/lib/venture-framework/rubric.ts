export type YesNo = "Yes" | "No";

export interface Criterion {
  category: string;
  name: string;
  five: string;
}

export interface Gate {
  gate: string;
  question: string;
}

export interface CategoryInfo {
  name: string;
  weight: number;
  covers: string;
}

export interface Lens {
  vertical: string;
  check: string;
  five: string;
  source: string;
}

export const STAGES = ["Pre-seed", "Seed", "Series A", "Series B+", "Liquid"] as const;

export const VERTICALS = [
  "Distributed Networks",
  "Data",
  "Unique Yield-Generating RWAs",
  "Exchanges for net-new assets",
  "Internet Labor Marketplaces",
  "Other",
] as const;

export const INSTRUMENTS = ["Equity", "Token", "Equity + token warrant", "Tokenized equity", "STAMP", "SAFT"] as const;
export const SCENARIOS = ["Wipeout", "Weak", "Base", "Strong", "Fund-returner"] as const;
export const VERTICAL_ROWS = 5;
export const MAX_DILUTION = 0.99;

export const CRITERIA: readonly Criterion[] = [
  { category: "Founding Team", name: "Domain expertise", five: "Deep grasp of the market's legal, technical and market dynamics; has worked inside it." },
  { category: "Founding Team", name: "Founder-market fit", five: "Archetype matches the sector's phase (integrators now); a pragmatic operator solving a concrete problem." },
  { category: "Founding Team", name: "Track record & integrity", five: "Has shipped and scaled before; references confirm honesty and integrity." },
  { category: "Founding Team", name: "Crypto expertise", five: "Understands token design, onchain distribution and where crypto revenue comes from." },
  { category: "Founding Team", name: "Shipping velocity", five: "Deploys often, iterates on feedback, open-sources work, architecture before feature count." },
  { category: "Founding Team", name: "Adaptability", five: "Corrects mistakes fast and changes course when the evidence turns." },
  { category: "Founding Team", name: "Operating principles", five: "Market cap lags product; no 'inevitable' or buy-the-token talk; public, sourced comms; small team." },
  { category: "Founding Team", name: "Charisma & communication", five: "Can recruit and sell. Judge depth separately: articulateness is not intelligence." },
  { category: "Fundamentals", name: "TAM + SOM", five: "Large, growing market with a credible serviceable share; end market can compound for decades." },
  { category: "Fundamentals", name: "Business model (B2B / B2C / B2B2C)", five: "Clear customer and payer; earns fees on contested state (trading) rather than plain transfers." },
  { category: "Fundamentals", name: "Revenue today", five: "Real revenue now; contracted ARR rather than a run rate annualized off one strong month." },
  { category: "Fundamentals", name: "Revenue quality & cyclicality", five: "Recurring rather than re-occurring; holds up in a low-activity scenario." },
  { category: "Fundamentals", name: "Unit economics", five: "Positive or clearly improving margins with a path to profitability." },
  { category: "Fundamentals", name: "Runway & sustainability", five: "Keeps working without new capital; long runway (see calc in section 4)." },
  { category: "Product", name: "Cost or product advantage", five: "Matches incumbents at lower cost or beats them on UX, speed or capability; structural, not subsidized." },
  { category: "Product", name: "Moat & durability", five: "Network effects that strengthen with scale, shared supply, retention that shows customers stay." },
  { category: "Product", name: "AI resilience", five: "Customers still pay when AI can check the work; priced on outcomes, not friction or opacity." },
  { category: "Product", name: "Competitive landscape", five: "Clear reason it wins against incumbents and well-funded copycats." },
  { category: "Product", name: "Ecosystem", five: "Credibly neutral; others build on it or plug into it." },
  { category: "Product", name: "Viability", five: "Feasible with today's tech and team; no unsolved core research." },
  { category: "Product", name: "Time-to-market", five: "Can ship before the window closes." },
  { category: "Product", name: "Product, not feature", five: "Standalone product people pay for, not a feature whose value is mainly strategic to an acquirer." },
  { category: "Valuation & Deal", name: "Entry valuation", five: "Reasonable multiple of forward revenue under mixed-activity scenarios; not priced to perfection." },
  { category: "Valuation & Deal", name: "Non-consensus", five: "Non-consensus and right, not a bid-up consensus deal." },
  { category: "Valuation & Deal", name: "Fund-returner potential", five: "Plausible path to the exit value needed to return the fund (section 4)." },
  { category: "Valuation & Deal", name: "Deal terms", five: "Enforceable claim and room to keep updating (e.g. STAMP, tokenized equity)." },
  { category: "Valuation & Deal", name: "Launch FDV", five: "Launch FDV treated as a ceiling and priced below comparable launches." },
  { category: "Tokenomics", name: "Needs a token?", five: "Token does real work (ownership, incentives, cold start); leave blank for pure equity deals." },
  { category: "Tokenomics", name: "Value accrual", five: "Revenue flows back to the token, or tokenized equity with legal recourse." },
  { category: "Tokenomics", name: "Emissions & dilution", five: "Emissions only for valuable work, not uptime; staking rewards treated as dilution, not earnings." },
  { category: "Tokenomics", name: "Revenue plan", five: "Token launches after sustainable revenue, or with a credible path to it." },
  { category: "Tokenomics", name: "Legal jurisdiction", five: "Clean structure and jurisdiction; regulatory tailwinds rather than headwinds." },
  { category: "Traction", name: "MVP", five: "Live product in users' hands." },
  { category: "Traction", name: "Users / beta testers", five: "Real, paying or retained users; farmed metrics heavily discounted." },
  { category: "Traction", name: "User feedback & retention", five: "Product fit improving, cohorts that stick, not just activity." },
  { category: "Traction", name: "Narrative and revenue", five: "Narrative brings users in and revenue keeps them; both working." },
  { category: "Backing", name: "Existing investors", five: "Top-tier lead acting as a credibility bridge; resources already attaching to the company." },
  { category: "Backing", name: "Industry connections", five: "Warm paths to customers, talent and distribution." },
  { category: "Backing", name: "Partnerships", five: "Signed, live partnerships rather than LOIs or logos." },
  { category: "Backing", name: "Access to capital", five: "Could raise the next round in a bear market; structure lets investors keep updating." },
  { category: "Macro", name: "Market sentiment", five: "Interest in the theme has faded (asymmetric entry) rather than peaked." },
  { category: "Macro", name: "Bear-market test", five: "Thesis survives falling prices and scarce funding; market agnostic." },
  { category: "Macro", name: "Capital environment & stage", five: "Capital flows and stage dynamics support the entry price." },
  { category: "Macro", name: "Rate & capex exposure", five: "Demand or yield doesn't depend on high rates or the AI/energy capex cycle continuing." },
  { category: "Vibes", name: "Gut feeling", five: "Would you still want in after sleeping on it?" },
  { category: "Vibes", name: "Design", five: "Product and brand design quality." },
  { category: "Vibes", name: "Deck & plain language", five: "Plain, concrete language; no red-flag phrases or abstract jargon." },
];

export const GATES: readonly Gate[] = [
  { gate: "Cash flows", question: "Is there a credible thesis for real cash flows, rather than reliance on new buyers?" },
  { gate: "Hold test", question: "Would you hold this asset if you could never sell it?" },
  { gate: "Sustainability", question: "Does it keep working without new capital coming in?" },
  { gate: "Red-flag language", question: "Is the pitch free of guarantees, urgency, insider appeals and unverifiable edge?" },
  { gate: "Integrity", question: "Do the founders pass the integrity check?" },
];

export const CATEGORIES: readonly CategoryInfo[] = [
  { name: "Founding Team", weight: 20, covers: "Team & Execution: who the founders are and how they operate" },
  { name: "Fundamentals", weight: 15, covers: "Fundamentals Filter: revenue, unit economics, sustainability" },
  { name: "Product", weight: 15, covers: "Structural Advantages: cost or product edge and how durable it is" },
  { name: "Valuation & Deal", weight: 10, covers: "Valuation matters / Non-consensus and right: price paid and fund-returner potential" },
  { name: "Tokenomics", weight: 10, covers: "Token vs. equity, value accrual, emissions" },
  { name: "Traction", weight: 10, covers: "Evidence of real, non-farmed usage" },
  { name: "Vertical Fit", weight: 5, covers: "Checks specific to the vertical picked on the Scorecard (Vertical Lenses tab)" },
  { name: "Backing", weight: 5, covers: "Investors, partners and access to capital" },
  { name: "Macro", weight: 5, covers: "Market Timing and Macro Backdrop" },
  { name: "Vibes", weight: 5, covers: "Gut feel, design and how they communicate" },
];

export const SCORE_SCALE: readonly [string, string][] = [
  ["0", "Red flag or absent"],
  ["1", "Weak"],
  ["2", "Below bar"],
  ["3", "Adequate"],
  ["4", "Strong"],
  ["5", "Exceptional; matches 'What a 5 looks like'"],
  ["Blank", "Not applicable, excluded from the score"],
];

export const VERTICAL_LENSES: readonly Lens[] = [
  { vertical: "Distributed Networks", check: "Granular geographic coverage", five: "The more granular the coverage, the harder it is to replicate.", source: "6th Man Ventures DePIN framework" },
  { vertical: "Distributed Networks", check: "Supply and demand overlap", five: "Operators also use the product, so they need fewer incentives and stay online.", source: "6th Man Ventures DePIN framework" },
  { vertical: "Distributed Networks", check: "Performance parity", five: "Competes on performance as well as cost; advantages are structural.", source: "Framework: Distributed Networks" },
  { vertical: "Distributed Networks", check: "Rewards tied to usage", five: "Usage-based rewards or InfraFi, not uptime; demand scales nonlinearly with supply.", source: "Framework: Distributed Networks" },
  { vertical: "Distributed Networks", check: "Hardware quality & node financing", five: "Payouts cover cost of financing per node without pushing to low-quality hardware.", source: "Framework: Distributed Networks" },
  { vertical: "Data", check: "Scarce data", five: "Private or behavioral data: operating records, agent traces, first-person video, conversational audio.", source: "Framework: Data" },
  { vertical: "Data", check: "Recurring access", five: "Ongoing licenses or multi-year exclusives rather than one-off sales.", source: "Framework: Data" },
  { vertical: "Data", check: "Rights & processing", five: "Clean rights and consent; in-house extraction and de-identification.", source: "Framework: Data" },
  { vertical: "Data", check: "Real buyers", five: "Signed buyer contracts with labs or big tech, not contributor counts.", source: "Framework: Data" },
  { vertical: "Unique Yield-Generating RWAs", check: "Onchain-first venue", five: "The chain is the first place the asset can be traded or borrowed against.", source: "Framework: RWAs" },
  { vertical: "Unique Yield-Generating RWAs", check: "New liquidity", five: "Usable as DeFi collateral; borrowers reach lenders they couldn't before.", source: "Framework: RWAs" },
  { vertical: "Unique Yield-Generating RWAs", check: "Funding fits the asset", five: "CapEx not funded with volatile tokens; IRR clears the CAPM/WACC hurdle.", source: "Framework: RWAs" },
  { vertical: "Unique Yield-Generating RWAs", check: "Yield resilience", five: "Real borrowers beyond treasuries; yield holds if rates fall or capex slows.", source: "Framework: RWAs" },
  { vertical: "Exchanges for net-new assets", check: "Net-new market", five: "The asset had no market before; not another venue for something that trades.", source: "Framework: Exchanges" },
  { vertical: "Exchanges for net-new assets", check: "Two-sided hedging demand", five: "Producers and consumers both need to hedge.", source: "Framework: Exchanges" },
  { vertical: "Exchanges for net-new assets", check: "Price index or oracle", five: "Credible index; pricing holds when the underlying market is closed.", source: "Framework: Exchanges" },
  { vertical: "Exchanges for net-new assets", check: "Listing & liquidity", five: "Permissionless listing with enough liquidity to trade.", source: "Framework: Exchanges" },
  { vertical: "Internet Labor Marketplaces", check: "Work units", five: "Prices, settles and verifies units of work.", source: "Framework: Internet Labor Marketplaces" },
  { vertical: "Internet Labor Marketplaces", check: "Verification", five: "Mixes cryptography with staking and slashing.", source: "Framework: Internet Labor Marketplaces" },
  { vertical: "Internet Labor Marketplaces", check: "Contributor ownership", five: "Tokens remove cold start, enable micro-payouts, contributors own the market.", source: "Framework: Internet Labor Marketplaces" },
];

export interface Settings {
  weights: number[];
  advanceAt: number;
  digDeeperAt: number;
  targetMultiple: number;
}

export interface Scenario {
  probability: number | null;
  exitValuation: number | null;
}

export interface Inputs {
  company: string;
  dateReviewed: string;
  stage: string;
  vertical: string;
  instrument: string;
  reviewer: string;
  gates: (YesNo | null)[];
  scores: (number | null)[];
  notes: string[];
  fundSize: number | null;
  checkSize: number | null;
  entryValuation: number | null;
  forwardRevenue: number | null;
  treasuryCash: number | null;
  monthlyBurn: number | null;
  dilution: number | null;
  scenarios: Scenario[];
}

export type FilterResult = "PASS" | "FAIL" | "Incomplete";
export type Verdict = "Pass: fails fundamentals filter" | "Incomplete" | "Advance to IC" | "Dig deeper" | "Pass";

export interface CategoryScore {
  name: string;
  weight: number;
  scored: number;
  avg: number | null;
  pct: number | null;
  points: number;
}

export interface ScenarioResult {
  multiple: number | null;
  weighted: number | null;
  returnsFund: YesNo | null;
}

export interface Results {
  filter: FilterResult;
  categories: CategoryScore[];
  weightedScore: number | null;
  verdict: Verdict;
  weakestCategory: string | null;
  ownershipAtEntry: number | null;
  ownershipAtExit: number | null;
  exitValueToReturnFund: number | null;
  requiredMultiple: number | null;
  entryPriceToSales: number | null;
  runwayMonths: number | null;
  scenarios: ScenarioResult[];
  totalProbability: number;
  probabilityOk: boolean;
  expectedMultiple: number | null;
  meetsTarget: YesNo | null;
  probabilityReturnsFund: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  weights: CATEGORIES.map((c) => c.weight),
  advanceAt: 75,
  digDeeperAt: 60,
  targetMultiple: 5,
};

export function emptyInputs(): Inputs {
  const rows = CRITERIA.length + VERTICAL_ROWS;
  return {
    company: "",
    dateReviewed: "",
    stage: "",
    vertical: "",
    instrument: "",
    reviewer: "",
    gates: GATES.map(() => null),
    scores: Array(rows).fill(null),
    notes: Array(rows).fill(""),
    fundSize: null,
    checkSize: null,
    entryValuation: null,
    forwardRevenue: null,
    treasuryCash: null,
    monthlyBurn: null,
    dilution: null,
    scenarios: SCENARIOS.map(() => ({ probability: null, exitValuation: null })),
  };
}

export function verticalRows(vertical: string): (Lens | null)[] {
  const matches = VERTICAL_LENSES.filter((l) => l.vertical === vertical);
  return Array.from({ length: VERTICAL_ROWS }, (_, i) => matches[i] ?? null);
}

export function rowCategory(row: number): string {
  return row < CRITERIA.length ? CRITERIA[row]!.category : "Vertical Fit";
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return (Math.sign(x) * Math.round(Math.abs(x) * f * (1 + Number.EPSILON))) / f;
}

const n = (x: number | null) => x ?? 0;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function compute(inputs: Inputs, settings: Settings): Results {
  const no = inputs.gates.filter((g) => g === "No").length;
  const yes = inputs.gates.filter((g) => g === "Yes").length;
  const filter: FilterResult = no > 0 ? "FAIL" : yes < GATES.length ? "Incomplete" : "PASS"; 
  const categories = CATEGORIES.map((c, i): CategoryScore => {
    const scores = inputs.scores.filter((s, row): s is number => s !== null && rowCategory(row) === c.name);
    const weight = settings.weights[i] ?? 0;
    const scored = scores.length;
    const avg = scored === 0 ? null : sum(scores) / scored;
    const pct = avg === null ? null : avg / 5;
    return { name: c.name, weight, scored, avg, pct, points: pct === null ? 0 : weight * pct };
  });
  const activeWeight = sum(categories.filter((c) => c.scored > 0).map((c) => c.weight));
  const weightedScore = activeWeight === 0 ? null : (sum(categories.map((c) => c.points)) / activeWeight) * 100;
  let verdict: Verdict; 
  if (filter === "FAIL") verdict = "Pass: fails fundamentals filter";
  else if (filter === "Incomplete" || weightedScore === null) verdict = "Incomplete";
  else if (weightedScore >= settings.advanceAt) verdict = "Advance to IC";
  else if (weightedScore >= settings.digDeeperAt) verdict = "Dig deeper";
  else verdict = "Pass";
  const pcts = categories.filter((c) => c.pct !== null);
  const minPct = Math.min(...pcts.map((c) => c.pct!));
  const weakestCategory = pcts.find((c) => c.pct === minPct)?.name ?? null;
  const fund = n(inputs.fundSize);
  const check = n(inputs.checkSize);
  const entry = n(inputs.entryValuation);
  const revenue = n(inputs.forwardRevenue);
  const burn = n(inputs.monthlyBurn);
  const dilution = n(inputs.dilution);
  const ownershipAtEntry = entry === 0 ? null : check / entry;
  const ownershipAtExit = entry === 0 ? null : (check / entry) * (1 - dilution);
  const exitValueToReturnFund = ownershipAtExit === null || ownershipAtExit === 0 ? null : fund / ownershipAtExit;
  const requiredMultiple = exitValueToReturnFund === null || entry === 0 ? null : exitValueToReturnFund / entry;
  const entryPriceToSales = revenue === 0 ? null : entry / revenue;
  const runwayMonths = burn === 0 ? null : n(inputs.treasuryCash) / burn;
  const scenarios = inputs.scenarios.map((s): ScenarioResult => {
    const multiple = entry === 0 || s.exitValuation === null ? null : (s.exitValuation * (1 - dilution)) / entry;
    const weighted = multiple === null ? null : n(s.probability) * multiple;
    const returnsFund =
      s.exitValuation === null || exitValueToReturnFund === null
        ? null
        : s.exitValuation >= exitValueToReturnFund
          ? "Yes"
          : "No";
    return { multiple, weighted, returnsFund };
  });
  const totalProbability = sum(inputs.scenarios.map((s) => n(s.probability))); 
  const probabilityOk = round(totalProbability, 4) === 1;
  const expectedMultiple = probabilityOk ? sum(scenarios.map((s) => n(s.weighted))) : null;
  const probabilityReturnsFund = probabilityOk
    ? sum(inputs.scenarios.map((s, i) => (scenarios[i]!.returnsFund === "Yes" ? n(s.probability) : 0)))
    : null;
  const meetsTarget = expectedMultiple === null ? null : expectedMultiple >= settings.targetMultiple ? "Yes" : "No";
  return {
    filter,
    categories,
    weightedScore,
    verdict,
    weakestCategory,
    ownershipAtEntry,
    ownershipAtExit,
    exitValueToReturnFund,
    requiredMultiple,
    entryPriceToSales,
    runwayMonths,
    scenarios,
    totalProbability,
    probabilityOk,
    expectedMultiple,
    meetsTarget,
    probabilityReturnsFund,
  };
}

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fixed = (x: number, d: number) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (x: number, body: (a: number) => string) => (x === 0 ? "-" : x < 0 ? `(${body(-x)})` : body(x));

export const fmt = {
  money: (x: number | null) => (x === null ? "" : signed(x, (a) => `$${int.format(a)}`)),
  pct1: (x: number | null) => (x === null ? "" : signed(x, (a) => `${fixed(a * 100, 1)}%`)),
  pct2: (x: number | null) => (x === null ? "" : `${fixed(x * 100, 2)}%`),
  num1: (x: number | null) => (x === null ? "" : fixed(x, 1)),
  mult1: (x: number | null) => (x === null ? "" : `${fixed(x, 1)}x`),
  mult2: (x: number | null) => (x === null ? "" : `${fixed(x, 2)}x`),
};
