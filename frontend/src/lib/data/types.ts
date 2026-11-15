// Data contract between the Python generator and the interface.
// The interface invents no fields: everything it shows comes from a Bundle.
// An unavailable value is `null` (unknown), never 0.

export type Provenance = 'fixture' | 'computed';

export interface Site {
  id: string;
  name: string;
  short: string;
  latDeg: number;
  lonDeg: number;
  frame: string;
  observerHeightM: number;
  source: string;
}

/** Terrain angle for each azimuth (0° = north, 90° = east). */
export interface HorizonProfile {
  siteId: string;
  stepDeg: number;
  /** elevDeg[i] belongs to azimuth i * stepDeg; null = no terrain data in that direction */
  elevDeg: (number | null)[];
  resolutionM: number | null;
  searchRadiusKm: number | null;
  source: string;
}

export interface BodySeries {
  azDeg: number[];
  elDeg: (number | null)[];
}

export interface Scenario {
  id: string;
  siteId: string;
  startUtc: string;
  /** hours from the first start in the bundle (informational; selection uses startUtc) */
  offsetH?: number;
  durationH: number;
  stepMin: number;
  sun: BodySeries;
  earth: BodySeries;
}

export interface Rules {
  /** The Sun's center must be strictly above terrain + this margin. */
  sunMarginDeg: number;
  /** The Earth's center must be at least this far above terrain (δ). */
  earthMarginDeg: number;
}

/** Where one data layer comes from. Optional; absent means "not declared". */
export interface LayerMeta {
  source: 'synthetic' | 'computed' | 'external';
  description: string;
  product?: string;
  version?: string;
  retrievedAt?: string;
  url?: string;
}

export interface ValidationCheck {
  label: string;
  ours: string;
  reference: string;
  difference: string;
  note?: string;
}

/** Validation status is reported separately from provenance. */
export interface Validation {
  status: 'not-validated' | 'partial' | 'validated';
  summary: string;
  checks?: ValidationCheck[];
}

export interface Bundle {
  provenance: Provenance;
  generatedAt: string;
  note: string;
  rules: Rules;
  sites: Site[];
  profiles: HorizonProfile[];
  scenarios: Scenario[];
  /** optional per-layer provenance; geometry = Sun/Earth positions, terrain = horizon profiles */
  layers?: { geometry?: LayerMeta; terrain?: LayerMeta };
  validation?: Validation;
  assumptions?: string[];
}
