import { mean } from '../../../core/index';

export function overfitRatio(isSharpe: number, oosSharpe: number): number {
  if (oosSharpe <= 0) return isSharpe > 0 ? Infinity : 0;
  return isSharpe / oosSharpe;
}

export function efficiency(isCagr: number, oosCagr: number): number {
  if (isCagr <= 0) return 0;
  return oosCagr / isCagr;
}

export function sharpeDecay(oosSharpes: readonly number[]): number {
  const n = oosSharpes.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(oosSharpes);
  let num = 0;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xMean) * (oosSharpes[i]! - yMean);
    denom += (i - xMean) ** 2;
  }
  return denom === 0 ? 0 : num / denom;
}

export function aggregateOverfitRatio(
  isSharpes: readonly number[],
  oosSharpes: readonly number[],
): number {
  return overfitRatio(mean(isSharpes), mean(oosSharpes));
}

export function aggregateEfficiency(
  isCagrs: readonly number[],
  oosCagrs: readonly number[],
): number {
  return efficiency(mean(isCagrs), mean(oosCagrs));
}
