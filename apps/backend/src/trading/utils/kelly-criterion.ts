import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export interface KellyResult {
  optimalFraction: number;
  expectedValue: number;
}

export interface KellyLandscapePoint {
  fraction: number;
  expectedValue: number;
}

export interface KellyLandscape {
  points: KellyLandscapePoint[];
  optimalFraction: number;
  optimalExpectedValue: number;
  halfKellyFraction: number;
  halfKellyExpectedValue: number;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function normalizeProbabilities(probabilities: number[]): number[] {
  const total = sum(probabilities);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Probabilities must have a positive finite sum.');
  }
  return probabilities.map((p) => p / total);
}

function expectedLogGrowth(
  fraction: number,
  odds: number[],
  probabilities: number[],
): number {
  let growth = 0;
  for (let i = 0; i < odds.length; i += 1) {
    const term = 1 + odds[i] * fraction;
    if (term <= 0) {
      return Number.NEGATIVE_INFINITY;
    }
    growth += probabilities[i] * Math.log(term);
  }
  return growth;
}

export function calculateGrowthRate(
  fraction: number,
  odds: number[],
  probabilities: number[],
): number {
  return expectedLogGrowth(fraction, odds, probabilities);
}

export function kellyCriterionNewton(
  odds: number[],
  probabilities: number[],
  initialValue = 0.25,
  threshold = 1e-6,
  maxIterations = 10_000,
): KellyResult {
  if (
    odds.length === 0 ||
    probabilities.length === 0 ||
    odds.length !== probabilities.length
  ) {
    throw new Error(
      'Odds and probabilities must be non-empty arrays with equal length.',
    );
  }

  const normalized = normalizeProbabilities(probabilities);
  // Zero-probability outcomes contribute nothing to growth and must not limit the domain.
  const live = odds
    .map((odd, i) => ({ b: odd, p: normalized[i] }))
    .filter((o) => o.p > 0);
  const b = live.map((o) => o.b);
  const p = live.map((o) => o.p);

  // g(f) = sum p * ln(1 + b f) is concave, so g'(f) is decreasing. If g'(0) <= 0, don't bet.
  if (sum(b.map((odd, i) => odd * p[i])) <= 0) {
    return { optimalFraction: 0, expectedValue: 1 };
  }

  const maxLoss = Math.max(0, ...b.map((odd) => -odd));
  if (maxLoss === 0) {
    throw new Error(
      'No outcome loses money, so the Kelly fraction is unbounded.',
    );
  }

  // The optimum lies in (0, 1 / maxLoss): g' > 0 at 0 and g' -> -infinity at the domain edge.
  // Newton steps that leave the bracket fall back to bisection, so f always stays in-domain.
  let lo = 0;
  let hi = 1 / maxLoss;
  let f = initialValue > lo && initialValue < hi ? initialValue : (lo + hi) / 2;

  for (let iterations = 0; iterations < maxIterations; iterations += 1) {
    let slope = 0;
    let curvature = 0;
    for (let i = 0; i < b.length; i += 1) {
      const base = 1 + b[i] * f;
      slope += (p[i] * b[i]) / base;
      curvature -= (p[i] * b[i] * b[i]) / (base * base);
    }

    if (slope > 0) lo = f;
    else hi = f;

    let next = f - slope / curvature;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;

    if (Math.abs(next - f) <= threshold || slope === 0) {
      f = slope === 0 ? f : next;
      return {
        optimalFraction: f,
        expectedValue: Math.exp(expectedLogGrowth(f, b, p)),
      };
    }
    f = next;
  }

  throw new Error(
    `Kelly solver did not converge within ${maxIterations} iterations.`,
  );
}

export function buildKellyLandscape(
  odds: number[],
  probabilities: number[],
  optimalFraction: number,
  sampleCount = 1_000,
): KellyLandscape {
  const probs = normalizeProbabilities(probabilities);
  const upperBound = Math.min(1, optimalFraction * 2);
  const span = Math.max(upperBound, 0);
  const denominator = Math.max(sampleCount - 1, 1);

  const points: KellyLandscapePoint[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const fraction = (span * i) / denominator;
    const growth = expectedLogGrowth(fraction, odds, probs);
    points.push({
      fraction,
      expectedValue: Number.isFinite(growth) ? Math.exp(growth) : 0,
    });
  }

  const optimalGrowth = expectedLogGrowth(optimalFraction, odds, probs);
  const halfKellyFraction = optimalFraction * 0.5;
  const halfKellyGrowth = expectedLogGrowth(halfKellyFraction, odds, probs);

  return {
    points,
    optimalFraction,
    optimalExpectedValue: Number.isFinite(optimalGrowth)
      ? Math.exp(optimalGrowth)
      : 0,
    halfKellyFraction,
    halfKellyExpectedValue: Number.isFinite(halfKellyGrowth)
      ? Math.exp(halfKellyGrowth)
      : 0,
  };
}

async function promptNumber(
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<number> {
  const raw = await rl.question(label);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric input: ${raw}`);
  }
  return value;
}

export async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    console.log('Kelly Criterion Calculator');
    console.log('-------------------------');

    const outcomes = await promptNumber(rl, 'Enter number of outcomes: ');
    if (!Number.isInteger(outcomes) || outcomes <= 0) {
      throw new Error('Number of outcomes must be a positive integer.');
    }

    const odds: number[] = [];
    const probs: number[] = [];

    for (let i = 0; i < outcomes; i += 1) {
      console.log(`\nOutcome ${i + 1}:`);
      const odd = await promptNumber(
        rl,
        `Enter return for outcome ${i + 1} (e.g., -1 for loss, 2 for 2:1 return): `,
      );
      const prob = await promptNumber(
        rl,
        `Enter probability for outcome ${i + 1} (e.g., 0.5 for 50%): `,
      );
      odds.push(odd);
      probs.push(prob);
    }

    const { optimalFraction: fullKelly, expectedValue: fullKellyEv } =
      kellyCriterionNewton(odds, probs);
    const normalizedProbs = normalizeProbabilities(probs);
    const halfKelly = fullKelly * 0.5;
    const halfKellyGrowth = expectedLogGrowth(halfKelly, odds, normalizedProbs);
    const halfKellyEv = Number.isFinite(halfKellyGrowth)
      ? Math.exp(halfKellyGrowth)
      : 0;

    console.log('\nResults:');
    console.log(`Full Kelly fraction: ${fullKelly.toFixed(4)}`);
    console.log(`Half Kelly fraction: ${halfKelly.toFixed(4)}`);
    console.log(`Expected Value at Full Kelly: ${fullKellyEv.toFixed(4)}`);
    console.log(`Expected Value at Half Kelly: ${halfKellyEv.toFixed(4)}`);

    console.log('\nDetailed Growth Rate Calculation for Full Kelly:');
    for (let i = 0; i < odds.length; i += 1) {
      const b = odds[i];
      const p = normalizedProbs[i];
      const term = p * Math.log(1 + b * fullKelly);
      console.log(`Outcome ${i + 1}: p=${p}, b=${b}`);
      console.log(
        `  Term = ${p} * ln(1 + ${b} * ${fullKelly.toFixed(4)}) = ${term.toFixed(4)}`,
      );
    }

    const growthRate = calculateGrowthRate(fullKelly, odds, normalizedProbs);
    console.log(`\nTotal growth rate (sum): ${growthRate.toFixed(4)}`);
    console.log(
      `Final EV = e^(${growthRate.toFixed(4)}) = ${fullKellyEv.toFixed(4)}`,
    );

    const landscape = buildKellyLandscape(odds, probs, fullKelly);
    console.log(`\nLandscape points generated: ${landscape.points.length}`);
    console.log(
      `Optimal point: f=${landscape.optimalFraction.toFixed(4)}, EV=${landscape.optimalExpectedValue.toFixed(4)}`,
    );
    console.log(
      `Half Kelly point: f=${landscape.halfKellyFraction.toFixed(4)}, EV=${landscape.halfKellyExpectedValue.toFixed(4)}`,
    );
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}
