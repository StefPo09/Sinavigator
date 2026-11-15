// The Horizons series from /api/ephemeris, fetched once per visit. Until it arrives (or if
// Horizons is unreachable) the transfer view uses the analytic formulas.
import { seriesEphemeris, type Ephemeris, type SeriesData } from '@/lib/logic/ephemerisSeries';

let request: Promise<Ephemeris | null> | null = null;
let ready: Ephemeris | null = null;

const valid = (d: SeriesData | null): d is SeriesData =>
  d != null &&
  Number.isFinite(d.startMs) &&
  d.stepMs > 0 &&
  Array.isArray(d.moon) &&
  Array.isArray(d.sun) &&
  d.moon.length > 1 &&
  d.moon.length === d.sun.length &&
  [...d.moon, ...d.sun].every((row) => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));

export function loadHorizonsEphemeris(): Promise<Ephemeris | null> {
  request ??= fetch('/api/ephemeris', { signal: AbortSignal.timeout(25_000) })
    .then((r) => (r.ok ? (r.json() as Promise<SeriesData>) : null))
    .then((d) => (ready = valid(d) ? seriesEphemeris(d) : null))
    .catch(() => null);
  return request;
}

/** The Horizons ephemeris if it has already loaded, otherwise null. */
export const horizonsEphemeris = () => ready;
