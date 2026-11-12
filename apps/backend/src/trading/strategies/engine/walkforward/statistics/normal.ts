// Helper for the port of backtester/walkforward/statistics (QuantJourney Backtester, Apache 2.0)
//
// Replaces scipy.stats.norm.cdf / norm.ppf.
//
// Accuracy (measured against scipy 1.x, z in [-37, 8], p in [1e-300, 1 - 1e-15]):
//   normCdf: erfc by power series (|x| < 2.5) or Lentz continued fraction
//         (|x| >= 2.5). Max relative error 2.3e-13 (deep lower tail), so far
//         below 1e-15 absolute everywhere and full-range relative precision.
//   normPpf: Acklam's rational approximation (relative error 1.15e-9) followed
//         by one Halley step against normCdf. Max relative error 1.9e-14.
//         The refinement always runs in the lower tail (via symmetry) so p
//         close to 1 keeps its precision.

const SQRT_PI = Math.sqrt(Math.PI);
const SQRT2 = Math.SQRT2;
const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Complementary error function. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2.5) {
    // erf(x) = 2/sqrt(pi) * exp(-x^2) * sum_n 2^n x^(2n+1) / (2n+1)!!  (all terms positive)
    const x2 = x * x;
    let term = x;
    let total = x;
    for (let n = 1; n < 200; n += 1) {
      term *= (2 * x2) / (2 * n + 1);
      total += term;
      if (term < total * 1e-17) break;
    }
    return 1 - (2 / SQRT_PI) * Math.exp(-x2) * total;
  }
  if (x > 27) return 0;
  // erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + ...)))), modified Lentz.
  const tiny = 1e-300;
  let f = x;
  let c = x;
  let d = 0;
  for (let n = 1; n < 500; n += 1) {
    const a = n / 2;
    d = x + a * d;
    d = d === 0 ? tiny : 1 / d;
    c = x + a / c;
    if (c === 0) c = tiny;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (SQRT_PI * f);
}

/** Standard normal CDF. */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / SQRT2);
}

// Acklam coefficients.
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1,
];
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416,
];
const P_LOW = 0.02425;

function acklam(p: number): number {
  if (p < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q +
        C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r +
      A[5]!) *
      q) /
    (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1)
  );
}

/** Standard normal quantile (inverse CDF). Returns -Inf/Inf at 0/1 and NaN outside [0, 1]. */
export function normPpf(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  if (p > 0.5) return -normPpf(1 - p); // 1 - p is exact for p > 0.5
  const x = acklam(p);
  // One Halley step: e = cdf(x) - p, u = e / pdf(x).
  const e = normCdf(x) - p;
  const u = e * SQRT_2PI * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
