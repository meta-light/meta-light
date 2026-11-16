export type Space<P> = { [K in keyof P]: readonly P[K][] };

export interface DescentResult<P> {
  params: P;
  score: number;
  evaluations: number;
  history: { pass: number; key: keyof P; value: unknown; score: number }[];
}

export function coordinateDescent<P extends Record<string, unknown>>(
  space: Space<P>,
  start: P,
  score: (p: P) => number,
  passes = 2,
): DescentResult<P> {
  const cache = new Map<string, number>();
  const evalOnce = (p: P): number => {
    const k = JSON.stringify(p);
    let s = cache.get(k);
    if (s === undefined) {
      s = score(p);
      cache.set(k, s);
    }
    return s;
  };
  let params = { ...start };
  let best = evalOnce(params);
  const history: DescentResult<P>['history'] = [];
  for (let pass = 0; pass < passes; pass++) {
    let improved = false;
    for (const key of Object.keys(space) as (keyof P)[]) {
      for (const value of space[key]) {
        const trial = { ...params, [key]: value };
        const s = evalOnce(trial);
        if (s > best) {
          best = s;
          params = trial;
          improved = true;
        }
      }
      history.push({ pass, key, value: params[key], score: best });
    }
    if (!improved) break;
  }
  return { params, score: best, evaluations: cache.size, history };
}
