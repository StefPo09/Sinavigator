// SYNTHETIC DEMONSTRATION DATA.
// These curves are NOT SPICE results and the profiles do NOT come from a DEM.
// They are deterministic, plausible shapes so the interface can be built and demonstrated
// before the Python generator exists. A valid public/data/bundle.json replaces them.

import type { Bundle, HorizonProfile, Scenario, Site } from './types.ts';

const T0 = Date.UTC(2026, 11, 1, 0, 0, 0);
const STARTS_H = [0, 24, 72];
const DURATION_H = 72;
const STEP_MIN = 10;

interface SiteModel {
  site: Site;
  seed: number;
  base: number;
  amp: number;
  gap?: [number, number];
  sun: { az0: number; c0: number; c1: number; phi: number };
  earth: { az0: number; e0: number; ep: number; eq: number };
}

const MODELS: SiteModel[] = [
  {
    site: {
      id: 'A',
      name: 'Study point A (synthetic)',
      short: 'Point A',
      latDeg: -89.45,
      lonDeg: 222.7,
      frame: 'none (synthetic)',
      observerHeightM: 2,
      source: 'Fictional coordinates — to be replaced by a documented study point',
    },
    seed: 26,
    base: 0.45,
    amp: 2.1,
    sun: { az0: 32, c0: 0.35, c1: 1.2, phi: -10 },
    earth: { az0: 2, e0: 3.0, ep: 0.4, eq: 2.0 },
  },
  {
    site: {
      id: 'B',
      name: 'Study point B (synthetic)',
      short: 'Point B',
      latDeg: -88.8,
      lonDeg: 124.5,
      frame: 'none (synthetic)',
      observerHeightM: 2,
      source: 'Fictional coordinates — to be replaced by a documented study point',
    },
    seed: 11,
    base: 1.0,
    amp: 2.6,
    gap: [98, 103],
    sun: { az0: 32, c0: 0.75, c1: 0.35, phi: 70 },
    earth: { az0: 355, e0: 5.4, ep: 1.3, eq: 2.3 },
  },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function makeProfile(m: SiteModel): HorizonProfile {
  const r = rng(m.seed);
  const K = 30;
  const amp: number[] = [];
  const ph: number[] = [];
  for (let k = 1; k <= K; k++) {
    amp.push((0.5 + r()) / Math.pow(k, 0.8));
    ph.push(r() * Math.PI * 2);
  }
  const raw: number[] = [];
  let max = 0;
  for (let i = 0; i < 360; i++) {
    const th = (i * Math.PI) / 180;
    let v = 0;
    for (let k = 1; k <= K; k++) v += amp[k - 1] * Math.sin(k * th + ph[k - 1]);
    raw.push(v);
    max = Math.max(max, Math.abs(v));
  }
  const elevDeg = raw.map((v, i) => {
    if (m.gap && i >= m.gap[0] && i <= m.gap[1]) return null;
    const n = v / max;
    return r3(m.base + m.amp * (n > 0 ? Math.pow(n, 1.25) : n * 0.55));
  });
  return {
    siteId: m.site.id,
    stepDeg: 1,
    elevDeg,
    resolutionM: null,
    searchRadiusKm: null,
    source: 'Synthetic profile (fixture) — not from LOLA / the PGDA 90 product',
  };
}

function makeScenario(m: SiteModel, offsetH: number): Scenario {
  const n = (DURATION_H * 60) / STEP_MIN + 1;
  const sun = { azDeg: [] as number[], elDeg: [] as (number | null)[] };
  const earth = { azDeg: [] as number[], elDeg: [] as (number | null)[] };
  for (let i = 0; i < n; i++) {
    const tH = offsetH + (i * STEP_MIN) / 60;
    const sAz = wrap360(m.sun.az0 + 0.508 * tH);
    sun.azDeg.push(r3(sAz));
    sun.elDeg.push(r3(m.sun.c0 + m.sun.c1 * Math.cos(((sAz - m.sun.phi) * Math.PI) / 180)));
    earth.azDeg.push(r3(wrap360(m.earth.az0 + 7.5 * Math.sin((2 * Math.PI * tH) / 655 + m.earth.ep))));
    earth.elDeg.push(r3(m.earth.e0 + 5.2 * Math.sin((2 * Math.PI * tH) / 653 + m.earth.eq)));
  }
  return {
    id: `${m.site.id}_${offsetH}`,
    siteId: m.site.id,
    startUtc: new Date(T0 + offsetH * 3600_000).toISOString(),
    offsetH,
    durationH: DURATION_H,
    stepMin: STEP_MIN,
    sun,
    earth,
  };
}

export function buildFixtureBundle(): Bundle {
  return {
    provenance: 'fixture',
    generatedAt: new Date(T0).toISOString(),
    note: 'Synthetic demo data. Not SPICE or DEM results; they describe no real lunar place.',
    layers: {
      geometry: { source: 'synthetic', description: 'Periodic azimuth–elevation curves for the Sun/Earth, generated in the browser' },
      terrain: { source: 'synthetic', description: 'Smooth random horizon profiles, with an intentional no-data sector at Point B' },
    },
    validation: { status: 'not-validated', summary: 'Synthetic data cannot be validated against references.' },
    assumptions: ['All values are synthetic and exist only to demonstrate the interface.'],
    rules: { sunMarginDeg: 0, earthMarginDeg: 2 },
    sites: MODELS.map((m) => m.site),
    profiles: MODELS.map(makeProfile),
    scenarios: MODELS.flatMap((m) => STARTS_H.map((h) => makeScenario(m, h))),
  };
}
