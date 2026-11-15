// Două locuri reale de aterizare, cu teren 3D de înaltă calitate (LROC NAC DTM + ortofoto NAC).
// Coordonatele sunt folosite în explorare și în generatorul datelor de vizibilitate.

export type CoordQuality = 'lroc' | 'agency' | 'approx';

export interface LandingSite {
  id: string;
  name: string;
  mission: string;
  agency: string;
  /** momentul aterizării modulului lunar (UTC) */
  landingUtc: string;
  latDeg: number;
  /** longitudine estică, [-180, 180] */
  lonDeg: number;
  quality: CoordQuality;
  source: string;
  /** de ce merită văzut locul */
  blurb: string;
  terrain: boolean;
}

const LROC = 'LROC — Wagner et al. (2016), „Coordinates of anthropogenic features on the Moon”, Icarus 279 (lunar module position)';

export const LANDING_SITES: LandingSite[] = [
  {
    id: 'apollo17',
    name: 'Apollo 17',
    mission: 'Apollo 17 · Challenger · Taurus–Littrow valley',
    agency: 'NASA',
    landingUtc: '1972-12-11T19:54:57Z',
    latDeg: 20.1911,
    lonDeg: 30.7723,
    quality: 'lroc',
    source: LROC,
    blurb: 'A narrow valley between the North and South Massifs, which rise more than 2 km above the valley floor.',
    terrain: true,
  },
  {
    id: 'apollo15',
    name: 'Apollo 15',
    mission: 'Apollo 15 · Falcon · Hadley–Apennine',
    agency: 'NASA',
    landingUtc: '1971-07-30T22:16:29Z',
    latDeg: 26.13239,
    lonDeg: 3.6333,
    quality: 'lroc',
    source: LROC,
    blurb: 'Next to the winding Hadley Rille canyon, at the foot of the Apennine Mountains (Mons Hadley, Hadley Delta).',
    terrain: true,
  },
];

export const QUALITY_LABEL: Record<CoordQuality, string> = {
  lroc: 'coordinates measured in LROC images',
  agency: 'coordinates published by the agency',
  approx: 'approximate position',
};
