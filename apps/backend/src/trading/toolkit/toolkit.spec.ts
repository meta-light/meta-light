import { ExitLadder } from './exits';
import { GateLog, quoteGates, type Gate } from './gates';
import { coordinateDescent } from './search';
import { EntryMemory, topK, topKPerGroup } from './selection';

interface C {
  id: string;
  score: number;
  step: number;
  group: string;
}

const c = (id: string, score: number, step = 0, group = 'g'): C => ({ id, score, step, group });

describe('GateLog', () => {
  it('counts the first failing gate per candidate', () => {
    const log = new GateLog();
    const gates: Gate<C>[] = [
      ['low-score', (x) => x.score > 0.1],
      ['odd-step', (x) => x.step % 2 === 0],
    ];
    const out = log.filter([c('a', 0.5), c('b', 0.05, 1), c('c', 0.5, 1), c('d', 0.2, 2)], gates);
    expect(out.map((x) => x.id)).toEqual(['a', 'd']);
    log.reject('capacity');
    expect(log.summary()).toEqual({ passed: 2, 'low-score': 1, 'odd-step': 1, capacity: 1 });
  });

  it('builds quote gates from limits', () => {
    const log = new GateLog();
    type Q = { now: number; q: { t: number; bid: number | null; ask: number | null; depth?: number } };
    const gates = quoteGates<Q>((x) => x.q, (x) => x.now, { maxAgeMs: 100, maxSpread: 0.05, minDepth: 10 });
    const out = log.filter<Q>(
      [
        { now: 50, q: { t: 0, bid: 0.4, ask: 0.42, depth: 20 } },
        { now: 50, q: { t: 0, bid: null, ask: 0.42 } },
        { now: 500, q: { t: 0, bid: 0.4, ask: 0.42, depth: 20 } },
        { now: 50, q: { t: 0, bid: 0.3, ask: 0.42, depth: 20 } },
        { now: 50, q: { t: 0, bid: 0.4, ask: 0.42, depth: 5 } },
      ],
      gates,
    );
    expect(out).toHaveLength(1);
    expect(log.summary()).toEqual({ passed: 1, 'quote:two-sided': 1, 'quote:stale': 1, 'quote:spread': 1, 'quote:depth': 1 });
  });
});

describe('EntryMemory', () => {
  it('blocks re-entry inside the cooldown and without enough score improvement', () => {
    const mem = new EntryMemory(3, 0.05);
    mem.record('a', 10, 0.5);
    const log = new GateLog();
    const gates = mem.gates<C>((x) => x.id, (x) => x.step, (x) => x.score);
    const out = log.filter([c('a', 0.9, 12), c('a', 0.52, 13), c('a', 0.6, 13), c('b', 0.1, 11)], gates);
    expect(out.map((x) => [x.id, x.score])).toEqual([
      ['a', 0.6],
      ['b', 0.1],
    ]);
    expect(log.summary()).toEqual({ passed: 2, cooldown: 1, hysteresis: 1 });
  });
});

describe('topK', () => {
  const xs = [c('a', 0.2, 0, 'x'), c('b', 0.9, 0, 'x'), c('c', 0.5, 0, 'y'), c('d', 0.7, 0, 'x')];

  it('takes the best k within free slots', () => {
    expect(topK(xs, (x) => x.score, 2, 0, 5).map((x) => x.id)).toEqual(['b', 'd']);
    expect(topK(xs, (x) => x.score, 3, 4, 5).map((x) => x.id)).toEqual(['b']);
    expect(topK(xs, (x) => x.score, 3, 5, 5)).toEqual([]);
  });

  it('caps picks per group', () => {
    expect(topKPerGroup(xs, (x) => x.score, (x) => x.group, 1).map((x) => x.id)).toEqual(['b', 'c']);
  });
});

describe('ExitLadder', () => {
  it('scales out at each level and moves the stop to breakeven', () => {
    const lad = new ExitLadder(100, {
      stopLoss: 0.1,
      takeProfits: [
        { at: 0.05, sell: 0.5 },
        { at: 0.1, sell: 0.5 },
      ],
      breakevenAfterFirst: true,
    });
    expect(lad.update(103)).toEqual([]);
    expect(lad.update(106)).toEqual([{ reason: 'take-profit', fraction: 0.5 }]);
    expect(lad.update(100)).toEqual([{ reason: 'trailing-stop', fraction: 0.5 }]);
    expect(lad.open).toBe(0);
    expect(lad.update(200)).toEqual([]);
  });

  it('fires several levels in one jump', () => {
    const lad = new ExitLadder(100, { stopLoss: 0.1, takeProfits: [{ at: 0.05, sell: 0.5 }, { at: 0.1, sell: 1 }] });
    expect(lad.update(120)).toEqual([
      { reason: 'take-profit', fraction: 0.5 },
      { reason: 'take-profit', fraction: 0.5 },
    ]);
    expect(lad.open).toBe(0);
  });

  it('distinguishes the hard stop from the trailing stop', () => {
    expect(new ExitLadder(100, { stopLoss: 0.1, takeProfits: [] }).update(89)).toEqual([{ reason: 'stop-loss', fraction: 1 }]);
    const trail = new ExitLadder(100, { stopLoss: 0.1, trailing: 0.05, takeProfits: [] });
    expect(trail.update(120)).toEqual([]);
    expect(trail.update(113)).toEqual([{ reason: 'trailing-stop', fraction: 1 }]);
  });
});

describe('coordinateDescent', () => {
  it('finds the optimum of a separable objective and caches evaluations', () => {
    let calls = 0;
    const res = coordinateDescent(
      { a: [0, 1, 2, 3], b: [-1, 0, 1] },
      { a: 0, b: -1 },
      (p) => {
        calls++;
        return -((p.a - 2) ** 2) - (p.b - 1) ** 2;
      },
    );
    expect(res.params).toEqual({ a: 2, b: 1 });
    expect(res.score).toBe(-0);
    expect(res.evaluations).toBe(calls);
  });
});
