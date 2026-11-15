// Poziții APROXIMATIVE pentru scena schematică Soare–Pământ–Lună.
// Formule analitice de joasă precizie (serii trunchiate, tip Almanac/Meeus), calculate în browser.
// NU sunt rezultate SPICE/NASA și nu intră în niciun calcul de vizibilitate: servesc doar la
// orientarea vizuală a scenei. Eroare tipică: sub ~0,5° în longitudine.

export const EPHEMERIS_LABEL =
  'Positions from simplified analytic formulas (≈ 0.5° precision), computed in the browser — not SPICE/NASA results and not used for the visibility windows.';

const RAD = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const AU_KM = 149_597_870.7;

export interface EclipticPos {
  /** longitudine ecliptică, grade */
  lonDeg: number;
  /** latitudine ecliptică, grade */
  latDeg: number;
  /** distanță, km */
  distKm: number;
}

const days = (ms: number) => (ms - J2000_MS) / 86_400_000;
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Direcția geocentrică a Soarelui (Pământ → Soare). */
export function sunGeocentric(ms: number): EclipticPos {
  const d = days(ms);
  const L = norm(280.46 + 0.9856474 * d);
  const g = norm(357.528 + 0.9856003 * d) * RAD;
  const lon = norm(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const rAu = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  return { lonDeg: lon, latDeg: 0, distKm: rAu * AU_KM };
}

/** Poziția geocentrică a Lunii (termenii principali). */
export function moonGeocentric(ms: number): EclipticPos {
  const d = days(ms);
  const Lp = norm(218.316 + 13.176396 * d);
  const Mp = norm(134.963 + 13.064993 * d) * RAD;
  const M = norm(357.529 + 0.98560028 * d) * RAD;
  const D = norm(297.85 + 12.190749 * d) * RAD;
  const F = norm(93.272 + 13.22935 * d) * RAD;
  const lon = norm(
    Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F),
  );
  const lat = 5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F);
  const dist = 385_001 - 20_905 * Math.cos(Mp) - 3_699 * Math.cos(2 * D - Mp) - 2_956 * Math.cos(2 * D);
  return { lonDeg: lon, latDeg: lat, distKm: dist };
}

/** Faza Lunii: unghi de elongație Soare–Lună (0 = Lună nouă, 180 = Lună plină) și fracția iluminată. */
export function moonPhase(ms: number): { elongDeg: number; illuminated: number } {
  const s = sunGeocentric(ms);
  const m = moonGeocentric(ms);
  const cosE = Math.cos(m.latDeg * RAD) * Math.cos((m.lonDeg - s.lonDeg) * RAD);
  const e = Math.acos(Math.max(-1, Math.min(1, cosE)));
  return { elongDeg: e / RAD, illuminated: (1 - Math.cos(e)) / 2 };
}

export const LOCAL_SKY_LABEL =
  'Approximate positions for exploring the surface (simplified analytic model, no libration). The comparison uses the separate series from the data file.';

/**
 * Cerul local aproximativ pentru un punct de pe Lună (lat/lon selenografice, grade).
 * Punctul subsolar se estimează din elongația Lunii (faza), punctul sub-Pământ este (0°, 0°)
 * (librația de ±7° este ignorată). Azimut 0 = nord, 90 = est.
 */
export function approxLocalSky(ms: number, latDeg: number, lonDeg: number) {
  const s = sunGeocentric(ms);
  const m = moonGeocentric(ms);
  const { elongDeg } = moonPhase(ms);
  const waxing = (m.lonDeg - s.lonDeg + 360) % 360 < 180;
  const subSunLon = waxing ? 180 - elongDeg : -(180 - elongDeg);
  const la = latDeg * RAD;
  const lo = lonDeg * RAD;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const local = (v: number[]) => {
    const n = Math.hypot(v[0], v[1], v[2]);
    const u = v.map((x) => x / n);
    return { azDeg: ((Math.atan2(dot(u, east), dot(u, north)) / RAD) + 360) % 360, elDeg: Math.asin(Math.max(-1, Math.min(1, dot(u, up)))) / RAD };
  };
  const ss = subSunLon * RAD;
  const sun = local([Math.cos(ss), Math.sin(ss), 0]);
  // Pământul la distanța reală (în raze lunare), cu paralaxa locului
  const d = m.distKm / 1737.4;
  const earth = local([d - up[0], -up[1], -up[2]]);
  return { sun, earth };
}

/** Coordonate ecliptice → vector scenă three.js (ecliptica = planul XZ, nordul ecliptic = +Y). */
export function toScene(p: { lonDeg: number; latDeg: number }, r: number): [number, number, number] {
  const l = p.lonDeg * RAD;
  const b = p.latDeg * RAD;
  return [r * Math.cos(b) * Math.cos(l), r * Math.sin(b), -r * Math.cos(b) * Math.sin(l)];
}
