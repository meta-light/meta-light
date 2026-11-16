export type Venue = 'kalshi' | 'polymarket';
export const VENUES: readonly Venue[] = ['kalshi', 'polymarket'];

export interface Station {
  icao: string;
  lat: number;
  lon: number;
}

export interface City {
  id: string;
  name: string;
  tz: string;
  stdOffset: number;
  kalshi: { series: string; station: Station };
  polymarket: { series: string; station: Station };
}

const KNYC = { icao: 'KNYC', lat: 40.779, lon: -73.969 };
const KLGA = { icao: 'KLGA', lat: 40.777, lon: -73.873 };
const KMDW = { icao: 'KMDW', lat: 41.786, lon: -87.752 };
const KORD = { icao: 'KORD', lat: 41.96, lon: -87.932 };
const KMIA = { icao: 'KMIA', lat: 25.788, lon: -80.317 };
const KAUS = { icao: 'KAUS', lat: 30.194, lon: -97.67 };
const KLAX = { icao: 'KLAX', lat: 33.938, lon: -118.389 };

export const CITIES: readonly City[] = [
  {
    id: 'nyc',
    name: 'New York',
    tz: 'America/New_York',
    stdOffset: -5,
    kalshi: { series: 'KXHIGHNY', station: KNYC },
    polymarket: { series: 'nyc-daily-weather', station: KLGA },
  },
  {
    id: 'chi',
    name: 'Chicago',
    tz: 'America/Chicago',
    stdOffset: -6,
    kalshi: { series: 'KXHIGHCHI', station: KMDW },
    polymarket: { series: 'chicago-daily-weather', station: KORD },
  },
  {
    id: 'mia',
    name: 'Miami',
    tz: 'America/New_York',
    stdOffset: -5,
    kalshi: { series: 'KXHIGHMIA', station: KMIA },
    polymarket: { series: 'miami-daily-weather', station: KMIA },
  },
  {
    id: 'aus',
    name: 'Austin',
    tz: 'America/Chicago',
    stdOffset: -6,
    kalshi: { series: 'KXHIGHAUS', station: KAUS },
    polymarket: { series: 'austin-daily-weather', station: KAUS },
  },
  {
    id: 'lax',
    name: 'Los Angeles',
    tz: 'America/Los_Angeles',
    stdOffset: -8,
    kalshi: { series: 'KXHIGHLAX', station: KLAX },
    polymarket: { series: 'los-angeles-daily-weather', station: KLAX },
  },
];

export function cityById(id: string): City {
  const c = CITIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown city "${id}" (have ${CITIES.map((x) => x.id).join(', ')})`);
  return c;
}
