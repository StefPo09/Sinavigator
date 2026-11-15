// Starea comună a spațiului de lucru, transmisă celor trei perspective.
// Perspectivele citesc aceeași dată, aceeași zonă și aceeași configurație.

import type { Bundle, HorizonProfile, Site } from '@/lib/data/types';
import type { Analysis, Body, Fit, Model } from '@/lib/logic/derive';
import type { Change } from '@/lib/logic/explain';
import type { AltOption } from '@/lib/logic/recommend';
import type { Catalog, Sel } from '@/lib/logic/scenarios';
import type { Coverage, Speed } from '@/lib/logic/timeline';
import type { LandingSite } from '@/lib/data/landingSites';
import type { Quality } from './quality';
import type { Trust } from '../zone/DecisionSummary';
import type { Side } from '../zone/ScenarioCards';

export type Perspective = 'sistem' | 'zone' | 'suprafata';

export interface Marker {
  side: 'A' | 'B';
  t: number;
  body: Body | 'both' | null;
}

export interface WS {
  bundle: Bundle;
  origin: 'file' | 'fixture';
  reason?: string;
  warnings: string[];
  cat: Catalog;
  analyses: Map<string, Analysis>;
  profileOf: (siteId: string) => HorizonProfile | undefined;
  synthetic: boolean;
  terrainSynthetic: boolean;
  noTerrain: Site[];
  trust: Trust;

  /* timp global */
  cov: Coverage;
  timeMs: number;
  playing: boolean;
  speed: Speed;
  seekUtc: (ms: number) => void;
  togglePlay: () => void;
  setSpeed: (s: Speed) => void;
  goNow: () => void;

  /* configurație */
  model: Model;
  setModel: (m: Model) => void;
  activityMin: number;
  setActivityMin: (m: number) => void;
  selA: Sel;
  selB: Sel | null;
  changeA: (s: Sel) => void;
  changeB: (s: Sel) => void;

  /* comparație derivată */
  A: Side | null;
  B: Side | null;
  sides: Side[];
  fits: Fit[];
  change: Change | null;
  options: AltOption[];
  readyFromMs: number;
  /** minute scurse de la startul lui A; null când momentul global nu este în scenariul A */
  cursorA: number | null;
  marker: Marker | null;
  seekElapsed: (min: number) => void;
  goEvent: (side: 'A' | 'B', t: number, body: Body | 'both' | null) => void;
  useOption: (o: AltOption) => void;
  exportJson: () => void;

  /* explorare: loc real de aterizare (fără analiză de vizibilitate) */
  landing: LandingSite | null;
  selectLanding: (id: string | null) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;

  note: string;
  setNote: (s: string) => void;
  showMission: () => void;
  go: (p: Perspective) => void;
  /** perspectiva curentă și cea din care s-a venit (pentru animațiile de intrare) */
  stage: Perspective;
  prevStage: Perspective | null;
  /** zborul de cameră în desfășurare; scena îl execută și apoi apelează arrive() */
  flight: null | 'moon' | 'site';
  arrive: () => void;
}
