// Geocentric Sun and Moon positions from a sampled NASA/JPL Horizons series, with the analytic
// formulas as the fallback outside the sampled span (or when Horizons could not be reached).
import { moonGeocentric, sunGeocentric, type EclipticPos } from './ephemeris.ts';

const AU_KM = 149_597_870.7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Ephemeris {
  moon: (ms: number) => EclipticPos;
  sun: (ms: number) => EclipticPos;
  /** Short credit for the positions, shown with any view that uses them. */
  label: string;
}

export const ANALYTIC_EPHEMERIS: Ephemeris = { moon: moonGeocentric, sun: sunGeocentric, label: 'analytic ephemeris (≈ 0.5°)' };

/** Evenly spaced rows of [ecliptic longitude °, ecliptic latitude °, distance km]. */
export interface SeriesData {
  source: string;
  startMs: number;
  stepMs: number;
  moon: [number, number, number][];
  sun: [number, number, number][];
}

type Row = [number, number, number];

function sample(rows: Row[], startMs: number, stepMs: number, ms: number, fallback: (ms: number) => EclipticPos): EclipticPos {
  const f = (ms - startMs) / stepMs;
  const i = Math.floor(f);
  if (!(i >= 0 && i + 1 < rows.length)) return fallback(ms);
  const t = f - i;
  const [l0, b0, r0] = rows[i];
  const [l1, b1, r1] = rows[i + 1];
  let dl = l1 - l0;
  if (dl > 180) dl -= 360;
  if (dl < -180) dl += 360;
  return { lonDeg: (((l0 + dl * t) % 360) + 360) % 360, latDeg: b0 + (b1 - b0) * t, distKm: r0 + (r1 - r0) * t };
}

export function seriesEphemeris(d: SeriesData): Ephemeris {
  return {
    moon: (ms) => sample(d.moon, d.startMs, d.stepMs, ms, moonGeocentric),
    sun: (ms) => sample(d.sun, d.startMs, d.stepMs, ms, sunGeocentric),
    label: d.source,
  };
}

/**
 * Parses a Horizons OBSERVER table requested with QUANTITIES='20,31' and CSV_FORMAT='YES'
 * (columns: date, , , delta [AU], deldot, ObsEcLon, ObsEcLat). Returns UTC times and rows.
 */
export function parseHorizonsObserver(text: string): { times: number[]; rows: Row[] } {
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error('Horizons: no ephemeris block in the response');
  const times: number[] = [];
  const rows: Row[] = [];
  for (const line of text.slice(start + 5, end).split('\n')) {
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 7 || !cols[0]) continue;
    const m = /^(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})/.exec(cols[0]);
    const month = m ? MONTHS.indexOf(m[2]) : -1;
    const delta = Number(cols[3]);
    const lon = Number(cols[5]);
    const lat = Number(cols[6]);
    if (!m || month < 0 || ![delta, lon, lat].every(Number.isFinite)) throw new Error(`Horizons: unreadable row "${line.trim()}"`);
    times.push(Date.UTC(+m[1], month, +m[3], +m[4], +m[5]));
    rows.push([lon, lat, delta * AU_KM]);
  }
  if (rows.length < 2) throw new Error('Horizons: too few rows');
  return { times, rows };
}
