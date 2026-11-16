import { Calibrator } from './calibration';
import type { EventView, Order, Side, Strategy } from './engine';
import type { Lead } from './model';

function edgeOrders(v: EventView, t: number, probs: readonly (number | null)[], minEdge: number, maxPerEvent: number): Order[] {
  const out: Order[] = [];
  v.event.buckets.forEach((b, i) => {
    const p = probs[i];
    if (p == null) return;
    for (const side of ['yes', 'no'] as Side[]) {
      const price = v.price(b, side, t);
      if (price == null) continue;
      const edge = (side === 'yes' ? p : 1 - p) - price - v.feePer(price);
      if (edge > minEdge) out.push({ bucket: b, side, t, edge });
    }
  });
  return out.sort((a, b) => b.edge! - a.edge!).slice(0, maxPerEvent);
}

function marketProbs(v: EventView, t: number): number[] | null {
  const mids = v.event.buckets.map((b) => v.mid(b, t));
  if (mids.some((m) => m == null)) return null;
  const sum = mids.reduce<number>((a, m) => a + m!, 0);
  return sum > 0 ? mids.map((m) => m! / sum) : null;
}

export function forecastEdge(lead: Lead, minEdge: number, maxPerEvent = 2, name = `edge-${lead}`): Strategy {
  return {
    name,
    decide(v) {
      const probs = v.probs(lead);
      return probs ? edgeOrders(v, v.decision(lead), probs, minEdge, maxPerEvent) : [];
    },
  };
}

export function blend(lead: Lead, w: number, minEdge: number, maxPerEvent = 2, name = `blend-${lead}-w${w}@${minEdge}`): Strategy {
  const clip = (p: number) => Math.min(0.995, Math.max(0.005, p));
  const logit = (p: number) => Math.log(clip(p) / (1 - clip(p)));
  return {
    name,
    decide(v) {
      const t = v.decision(lead);
      const model = v.probs(lead);
      const market = model && marketProbs(v, t);
      if (!model || !market) return [];
      const pooled = model.map((m, i) => 1 / (1 + Math.exp(-(w * logit(m) + (1 - w) * logit(market[i]!)))));
      const sum = pooled.reduce((a, b) => a + b, 0);
      return edgeOrders(v, t, pooled.map((p) => p / sum), minEdge, maxPerEvent);
    },
  };
}

export function calibrated(lead: Lead, minEdge: number, maxPerEvent = 2, name = `calibrated-${lead}@${minEdge}`): Strategy {
  const cal = new Calibrator();
  return {
    name,
    decide(v) {
      const t = v.decision(lead);
      const { venue, date, buckets } = v.event;
      const mids = buckets.map((b) => v.mid(b, t));
      const probs = mids.map((m) => (m == null ? null : cal.prob(venue, lead, date, m)));
      buckets.forEach((b, i) => mids[i] != null && cal.observe(venue, lead, date, mids[i]!, b.result));
      return t < v.event.closeMs ? edgeOrders(v, t, probs, minEdge, maxPerEvent) : [];
    },
  };
}

export function priceBand(side: Side, lo: number, hi: number, lead: Lead, name = `band-${side}-${lead}-${lo}-${hi}`): Strategy {
  return {
    name,
    decide(v) {
      const t = v.decision(lead);
      return v.event.buckets
        .filter((b) => {
          const m = v.mid(b, t);
          return m != null && m >= lo && m <= hi;
        })
        .map((b) => ({ bucket: b, side, t }));
    },
  };
}

export const fadeLongshots = (lo = 0.05, hi = 0.15, lead: Lead = 'd-1'): Strategy => priceBand('no', lo, hi, lead, 'fade-longshots');

export function priceMove(mode: 'revert' | 'follow', minMove = 0.1, lookbackH = 6, lead: Lead = 'd0-am', name?: string): Strategy {
  return {
    name: name ?? (mode === 'revert' ? 'mean-revert' : `momentum-${lead}-${minMove}`),
    decide(v) {
      const t = v.decision(lead);
      let best: { order: Order; move: number } | null = null;
      for (const b of v.event.buckets) {
        const now = v.mid(b, t);
        const then = v.mid(b, t - lookbackH * 3_600_000);
        if (now == null || then == null) continue;
        const move = now - then;
        if (Math.abs(move) >= minMove && (!best || Math.abs(move) > Math.abs(best.move))) {
          const up = move > 0;
          best = { order: { bucket: b, side: up === (mode === 'follow') ? 'yes' : 'no', t }, move };
        }
      }
      return best ? [best.order] : [];
    },
  };
}

export const meanRevert = (minMove = 0.1, lookbackH = 6, lead: Lead = 'd0-am'): Strategy => priceMove('revert', minMove, lookbackH, lead);

export const MIN_EDGES = [0.03, 0.05, 0.08, 0.12] as const;

export function lineup(minEdges: readonly number[] = MIN_EDGES): Strategy[] {
  const out: Strategy[] = [];
  for (const e of minEdges) {
    const tag = `@${e}`;
    out.push(forecastEdge('d-1', e, 2, `edge-d-1${tag}`));
    out.push(forecastEdge('d0-am', e, 2, `edge-d0-am${tag}`));
    out.push(forecastEdge('d0-pm', e, 2, `nowcast${tag}`));
  }
  out.push(fadeLongshots(), meanRevert());
  return out;
}

export function explore(): Strategy[] {
  const leads: Lead[] = ['d-2', 'd-1', 'd0-am'];
  const out: Strategy[] = [forecastEdge('d-2', 0.05, 2, 'edge-d-2@0.05')];
  for (const lead of leads) {
    for (const e of [0.03, 0.06]) out.push(calibrated(lead, e));
    for (const w of [0.2, 0.4]) out.push(blend(lead, w, 0.03));
  }
  for (const lead of ['d0-am', 'd0-pm'] as Lead[]) out.push(priceMove('follow', 0.1, 6, lead));
  for (const lead of leads) {
    for (const [lo, hi] of [[0.02, 0.05], [0.05, 0.1], [0.1, 0.2]] as const) out.push(priceBand('no', lo, hi, lead));
    for (const [lo, hi] of [[0.5, 0.7], [0.7, 0.85], [0.85, 0.95]] as const) out.push(priceBand('yes', lo, hi, lead));
  }
  return out;
}
