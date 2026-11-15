import type { Bundle, Scenario } from '../data/types';

export interface AngularPosition {
  azDeg: number;
  elDeg: number;
}

export interface SiteSky {
  scenarioId: string;
  sun: AngularPosition;
  earth: AngularPosition | null;
}

export interface Direction3 {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;
const wrap = (deg: number) => ((deg % 360) + 360) % 360;

function interpolateAngle(start: number, end: number, fraction: number): number {
  const delta = ((end - start + 540) % 360) - 180;
  return wrap(start + delta * fraction);
}

function sampleSeries(
  scenario: Scenario,
  body: 'sun' | 'earth',
  timeMs: number,
): AngularPosition | null {
  const startMs = Date.parse(scenario.startUtc);
  const index = (timeMs - startMs) / (scenario.stepMin * 60_000);
  const series = scenario[body];
  if (!Number.isFinite(index) || index < 0 || index > series.elDeg.length - 1) return null;

  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, series.elDeg.length - 1);
  const fraction = index - lower;
  const el0 = series.elDeg[lower];
  const el1 = series.elDeg[upper];
  if (el0 == null) return null;
  if (fraction === 0 || lower === upper) return { azDeg: series.azDeg[lower], elDeg: el0 };
  if (el1 == null) return null;

  return {
    azDeg: interpolateAngle(series.azDeg[lower], series.azDeg[upper], fraction),
    elDeg: el0 + (el1 - el0) * fraction,
  };
}

/** Samples the fetched Horizons series for the site and UTC time, interpolating between records. */
export function siteSkyAt(bundle: Bundle, siteId: string, timeMs: number): SiteSky | null {
  const scenarios = bundle.scenarios
    .filter((scenario) => {
      if (scenario.siteId !== siteId) return false;
      const start = Date.parse(scenario.startUtc);
      return timeMs >= start && timeMs <= start + scenario.durationH * 3_600_000;
    })
    .sort((a, b) => Date.parse(b.startUtc) - Date.parse(a.startUtc));

  for (const scenario of scenarios) {
    const sun = sampleSeries(scenario, 'sun', timeMs);
    if (sun) {
      return {
        scenarioId: scenario.id,
        sun,
        earth: sampleSeries(scenario, 'earth', timeMs),
      };
    }
  }
  return null;
}

/** Converts local north-clockwise azimuth/elevation to the Moon model's fixed XYZ axes. */
export function localSkyDirection(
  latDeg: number,
  lonDeg: number,
  position: AngularPosition,
): Direction3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const az = position.azDeg * DEG;
  const el = position.elDeg * DEG;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);
  const eastAmount = Math.sin(az) * Math.cos(el);
  const northAmount = Math.cos(az) * Math.cos(el);
  const upAmount = Math.sin(el);

  return {
    x: eastAmount * -sinLon + northAmount * -sinLat * cosLon + upAmount * cosLat * cosLon,
    y: northAmount * cosLat + upAmount * sinLat,
    z: eastAmount * -cosLon + northAmount * sinLat * sinLon - upAmount * cosLat * sinLon,
  };
}
