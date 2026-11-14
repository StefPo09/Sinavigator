import { moonGeocentric, sunGeocentric } from './ephemeris.ts';

const RAD = Math.PI / 180;
const HOUR = 3_600_000;
const EARTH_MU = 398_600.4418; // km³/s²
const PARKING_RADIUS = 6_378.137 + 200; // km from Earth's centre
const MOON_RADIUS = 1_737.4;
const wrap180 = (degrees: number) => ((degrees + 540) % 360) - 180;

export interface Transfer {
  departureMs: number;
  arrivalMs: number;
  encounter: ReturnType<typeof moonGeocentric>;
}

const halfPeriodMs = (apoapsis: number) =>
  Math.PI * Math.sqrt(((PARKING_RADIUS + apoapsis) / 2) ** 3 / EARTH_MU) * 1000;

function candidate(departureMs: number) {
  // At apogee the ideal ellipse meets the near edge of the moving Moon.
  let arrivalMs = departureMs + halfPeriodMs(384_400 - MOON_RADIUS);
  for (let i = 0; i < 10; i++) {
    arrivalMs = departureMs + halfPeriodMs(moonGeocentric(arrivalMs).distKm - MOON_RADIUS);
  }
  const encounter = moonGeocentric(arrivalMs);
  const error = wrap180(encounter.lonDeg - sunGeocentric(departureMs).lonDeg - 180);
  return { departureMs, arrivalMs, encounter, error };
}

/**
 * First departure after now under the model's alignment rule: injection from the sunward
 * longitude of an ideal 200 km Earth orbit, with apogee at the Moon's future longitude.
 * The parking orbit is assumed to be available in the required plane. This is a single
 * modeled opportunity, with no Earth launch, lunar capture, or descent calculation.
 */
export function nextLunarTransfer(now: number): Transfer | null {
  if (!Number.isFinite(now)) return null;
  let left = candidate(now);
  if (Math.abs(left.error) < 1e-9) return left;
  for (let i = 1; i <= 40 * 24; i++) {
    let right = candidate(now + i * HOUR);
    if (left.error < 0 && right.error >= 0) {
      while (right.departureMs - left.departureMs > 1000) {
        const middle = candidate((left.departureMs + right.departureMs) / 2);
        if (middle.error >= 0) right = middle;
        else left = middle;
      }
      return right;
    }
    left = right;
  }
  return null;
}

export type Point = readonly [x: number, y: number];

/** Earth-centred projection onto the ecliptic, rotated so encounter is to the right. */
export function transferFrame(transfer: Transfer, fraction: number) {
  const p = Math.max(0, Math.min(1, fraction));
  const timeMs = transfer.departureMs + p * (transfer.arrivalMs - transfer.departureMs);
  const moon = moonGeocentric(timeMs);
  const sun = sunGeocentric(timeMs);
  const apoapsis = transfer.encounter.distKm - MOON_RADIUS;
  const a = (apoapsis + PARKING_RADIUS) / 2;
  const e = (apoapsis - PARKING_RADIUS) / (apoapsis + PARKING_RADIUS);
  const meanAnomaly = Math.PI * p;
  // Kepler's equation preserves speed changes along the ellipse.
  let low = 0;
  let high = Math.PI;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (mid - e * Math.sin(mid) < meanAnomaly) low = mid;
    else high = mid;
  }
  const anomaly = (low + high) / 2;
  const relativeLongitude = (moon.lonDeg - transfer.encounter.lonDeg) * RAD;
  const moonProjected = moon.distKm * Math.cos(moon.latDeg * RAD);
  return {
    timeMs,
    moon: [moonProjected * Math.cos(relativeLongitude), moonProjected * Math.sin(relativeLongitude)] as Point,
    craft: [
      -a * (Math.cos(anomaly) - e) * Math.cos(transfer.encounter.latDeg * RAD),
      -a * Math.sqrt(1 - e * e) * Math.sin(anomaly),
    ] as Point,
    sunAngle: (sun.lonDeg - transfer.encounter.lonDeg) * RAD,
  };
}
