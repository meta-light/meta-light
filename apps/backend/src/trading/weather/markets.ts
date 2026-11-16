export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  strike_type: string;
  floor_strike?: number | null;
  cap_strike?: number | null;
  result: string;
  status: string;
  open_time: string;
  close_time: string;
  expiration_value?: string;
  yes_sub_title?: string;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function eventDate(eventTicker: string): string | null {
  const m = /-(\d{2})([A-Z]{3})(\d{2})$/.exec(eventTicker);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]!);
  if (month < 0) return null;
  return `20${m[1]}-${String(month + 1).padStart(2, '0')}-${m[3]}`;
}

export function strikeRange(m: Pick<KalshiMarket, 'strike_type' | 'floor_strike' | 'cap_strike'>): [number, number] | null {
  const f = m.floor_strike;
  const c = m.cap_strike;
  if (m.strike_type === 'greater' && f != null) return [Math.floor(f) + 1, Infinity];
  if (m.strike_type === 'less' && c != null) return [-Infinity, Math.ceil(c) - 1];
  if (m.strike_type === 'between' && f != null && c != null) return [f, c];
  return null;
}

export const SERIES_IDS: Record<string, number> = {
  'nyc-daily-weather': 10005,
  'chicago-daily-weather': 10726,
  'miami-daily-weather': 10728,
  'austin-daily-weather': 11367,
  'los-angeles-daily-weather': 11370,
};

export interface GammaMarket {
  groupItemTitle?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  feesEnabled?: boolean;
  feeSchedule?: { rate?: number } | null;
}

export interface GammaEvent {
  slug: string;
  startDate?: string;
  endDate: string;
  closedTime?: string;
  markets: GammaMarket[];
}

export function parseTitle(title: string): [number, number] | null {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!/°?F\b/.test(t) || /°C/.test(t)) return null;
  let m = /^(-?\d+)\s*°?F? or (below|lower|less)$/i.exec(t);
  if (m) return [-Infinity, Number(m[1])];
  m = /^(-?\d+)\s*°?F? or (higher|above|more)$/i.exec(t);
  if (m) return [Number(m[1]), Infinity];
  m = /^(-?\d+)\s*[-–]\s*(-?\d+)\s*°?F$/.exec(t);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^(-?\d+)\s*°F$/.exec(t);
  if (m) return [Number(m[1]), Number(m[1])];
  return null;
}

export const parseList = (s: string | undefined): string[] => {
  try {
    return s ? (JSON.parse(s) as string[]) : [];
  } catch {
    return [];
  }
};
