// Lecția „două ore cu Soarele și Pământul”: concluzii, explicații „De ce?” și
// date pentru timeline, construite numai din analizele calculate. Fără model de limbaj.

import type { Scenario } from '../data/types.ts';
import { closingCause, windowLen, type Analysis, type Body, type Detail, type Fit, type Model, type VisState } from './derive.ts';
import { fmtDeg, fmtDur, fmtUtcMs } from './format.ts';

const MIN = 60_000;

/* ───────────── direcții ───────────── */

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const CARD_WORD: Record<(typeof CARD)[number], string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};
const norm = (az: number) => ((az % 360) + 360) % 360;
export const cardinal = (az: number) => CARD[Math.round(norm(az) / 45) % 8];
export const cardinalWord = (az: number) => CARD_WORD[cardinal(az)];
/** Diferența unghiulară circulară, în [-180, 180). */
export const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export const BODY_NOM: Record<Body, string> = { sun: 'The Sun', earth: 'The Earth' };

/* ───────────── concluzia în cuvinte ───────────── */

export interface Conclusion {
  kind: Fit['kind'];
  /** propoziția principală, cu valori calculate */
  text: string;
  /** domeniul analizat, UTC */
  domain: string;
}

export function conclusion(an: Analysis, t0: number, fit: Fit, activityMin: number): Conclusion {
  const domain = `${fmtUtcMs(t0)} → ${fmtUtcMs(t0 + an.totalMin * MIN)}`;
  const act = fmtDur(activityMin);
  if (fit.kind === 'fits' && fit.first) {
    const w = fit.first;
    const len = fmtDur(windowLen(w));
    const atLeast = w.truncStart || w.truncEnd ? 'at least ' : '';
    const span = `${fmtUtcMs(t0 + w.start * MIN)} → ${fmtUtcMs(t0 + w.end * MIN)}`;
    const edges = [w.truncStart ? 'already open when the analysed period starts' : '', w.truncEnd ? 'still open when it ends' : ''].filter(Boolean).join(' and ');
    return {
      kind: 'fits',
      domain,
      text: `The Sun and Earth are visible together for ${atLeast}${len} (${span}${edges ? `; the window is ${edges}` : ''}). The ${act} activity fits, with ${fmtDur(fit.spareMin)} to spare${w.truncStart || w.truncEnd ? ' within the known period' : ''}.`,
    };
  }
  if (fit.kind === 'insufficient')
    return {
      kind: 'insufficient',
      domain,
      text: `No known common window reaches ${act}, but some intervals have no data and could hide one. Not enough data to answer.`,
    };
  const longest = fit.longest;
  return {
    kind: 'none',
    domain,
    text: longest
      ? `The Sun and Earth are visible together for at most ${fmtDur(windowLen(longest))}${longest.truncEnd ? ' (the window continues past the end of the period, so its full length is unknown)' : ''}. The ${act} activity does not fit in the known period.`
      : `The Sun and Earth are never visible together in the analysed period. The ${act} activity does not fit in the known period.`,
  };
}

/* ───────────── „De ce?” ───────────── */

export type WhyKind = 'visible' | 'below-ideal' | 'terrain' | 'threshold' | 'unknown';

export interface Why {
  body: Body;
  kind: WhyKind;
  /** minute de la startul scenariului, pe grila eșantioanelor */
  t: number;
  az: number | null;
  el: number | null;
  hor: number | null;
  text: string;
}

/** Explicația stării unui corp la eșantionul de la sau imediat după `t`, cu regula activă. */
export function whyAt(an: Analysis, model: Model, body: Body, t: number): Why {
  const i = Math.min(an.n - 1, Math.max(0, Math.ceil(t / an.stepMin - 1e-6)));
  const tr = an[body];
  const az = tr.az[i] ?? null;
  const el = tr.el[i];
  const hor = tr.hor[i];
  const name = BODY_NOM[body];
  const base = { body, t: i * an.stepMin, az, el, hor };
  if (el == null || hor == null || az == null) return { ...base, kind: 'unknown', text: `There is no data for ${name.toLowerCase()} or the terrain at this sample. Its state stays unknown.` };
  const dir = `the ${cardinalWord(az)} (azimuth ${fmtDeg(az, 0)})`;
  const thr = tr.threshold;
  const margin = el - hor;
  const ok = tr.strict ? margin > thr : margin >= thr;
  if (ok)
    return {
      ...base,
      kind: 'visible',
      text: `${name} is at ${fmtDeg(el, 1)} towards ${dir}, above ${model === 'ideal' ? 'the ideal 0° horizon' : `the terrain (${fmtDeg(hor, 1)})`}. It is visible${thr ? ` with the required ${fmtDeg(thr, 0)} margin` : ''}.`,
    };
  if (el < 0)
    return {
      ...base,
      kind: 'below-ideal',
      text: `${name} is at ${fmtDeg(el, 1)}, below the horizon plane towards ${dir}. It would not be visible even without terrain${body === 'sun' ? ': it is lunar night here' : ''}.`,
    };
  if (model === 'terrain' && el < hor)
    return {
      ...base,
      kind: 'terrain',
      text: `The terrain towards ${dir} rises to ${fmtDeg(hor, 1)}, and ${name.toLowerCase()} is at ${fmtDeg(el, 1)}. In this model, the terrain hides it.`,
    };
  return {
    ...base,
    kind: 'threshold',
    text: `${name} is at ${fmtDeg(el, 1)}, only ${fmtDeg(margin, 1)} above ${model === 'ideal' ? 'the ideal horizon' : 'the terrain'} towards ${dir}. The project rule asks for at least ${fmtDeg(thr, 0)}${body === 'earth' ? ' for the Earth' : ''}.`,
  };
}

/** Ce limitează activitatea: corpul care închide cea mai lungă fereastră sau, fără fereastră, corpul ascuns cel mai mult. */
export function limitingWhy(an: Analysis, model: Model, fit: Fit): Why | null {
  if (fit.kind === 'fits') return null;
  const w = fit.longest;
  if (w) {
    const c = closingCause(an, w);
    if (c.kind === 'period-end') return null;
    const body: Body = c.body === 'earth' ? 'earth' : 'sun';
    return whyAt(an, model, body, c.t);
  }
  const hidden = (b: Body) => an[b].state.filter((s) => s === 'hid').length;
  const body: Body = hidden('sun') >= hidden('earth') ? 'sun' : 'earth';
  const i = Math.max(0, an[body].state.indexOf('hid'));
  return whyAt(an, model, body, i * an.stepMin);
}

/* ───────────── răspunsul misiunii ───────────── */

export type Answer = 'A' | 'B' | 'both' | 'none' | 'insufficient';

export const ANSWER_LABEL: Record<Answer, string> = {
  A: 'Only A',
  B: 'Only B',
  both: 'Both',
  none: 'Neither',
  insufficient: 'Not enough data',
};

/** Răspunsul calculat: ce variante încap. O variantă necunoscută nu devine „nu încape”. */
export function expectedAnswer(a: Fit, b: Fit): Answer {
  const fa = a.kind === 'fits';
  const fb = b.kind === 'fits';
  if (fa && fb) return 'both';
  if (fa) return 'A';
  if (fb) return 'B';
  return a.kind === 'insufficient' || b.kind === 'insufficient' ? 'insufficient' : 'none';
}

/* ───────────── timeline: un loc, toate scenariile lui ───────────── */

export interface SiteSeg {
  startMs: number;
  endMs: number;
  state: Detail;
}

export interface SiteEvent {
  ms: number;
  body: Body;
  /** 'rise' = devine vizibil, 'set' = devine ascuns, 'unk' = datele devin necunoscute */
  kind: 'rise' | 'set' | 'unk';
  /** plasat prin interpolare între două eșantioane cunoscute (≈ un pas) */
  approx: boolean;
}

export interface SiteTrack {
  siteId: string;
  segs: SiteSeg[];
  events: SiteEvent[];
  startMs: number;
  endMs: number;
}

const toKind = (to: VisState): SiteEvent['kind'] => (to === 'vis' ? 'rise' : to === 'hid' ? 'set' : 'unk');

/**
 * Lipește scenariile unui loc pe axa UTC. Unde două scenarii se suprapun, se folosește cel care a
 * început primul; partea următorului scenariu începe de unde se termină precedentul.
 */
export function siteTrack(scenarios: Scenario[], analyses: Map<string, Analysis>, siteId: string): SiteTrack | null {
  const list = scenarios.filter((s) => s.siteId === siteId && analyses.has(s.id)).sort((x, y) => Date.parse(x.startUtc) - Date.parse(y.startUtc));
  if (!list.length) return null;
  const segs: SiteSeg[] = [];
  const events: SiteEvent[] = [];
  let covered = -Infinity;
  for (const sc of list) {
    const an = analyses.get(sc.id)!;
    const t0 = Date.parse(sc.startUtc);
    const end = t0 + an.totalMin * MIN;
    if (end <= covered) continue;
    const from = Math.max(t0, covered);
    for (const g of an.detail) {
      const s = Math.max(from, t0 + g.start * MIN);
      const e = t0 + g.end * MIN;
      if (e <= s) continue;
      const last = segs[segs.length - 1];
      if (last && last.state === g.state && Math.abs(last.endMs - s) < 1) last.endMs = e;
      else segs.push({ startMs: s, endMs: e, state: g.state });
    }
    for (const b of ['sun', 'earth'] as const)
      for (const tr of an[b].transitions) {
        const ms = t0 + tr.t * MIN;
        if (ms <= from + 1 || ms >= end - 1) continue;
        events.push({ ms, body: b, kind: toKind(tr.to), approx: tr.interpolated });
      }
    covered = end;
  }
  events.sort((x, y) => x.ms - y.ms);
  return { siteId, segs, events, startMs: segs[0].startMs, endMs: segs[segs.length - 1].endMs };
}

/** Scenariul unui loc care acoperă momentul dat (cel început primul). */
export function scenarioAt(scenarios: Scenario[], siteId: string, ms: number): Scenario | null {
  return (
    scenarios
      .filter((s) => s.siteId === siteId && ms >= Date.parse(s.startUtc) && ms <= Date.parse(s.startUtc) + s.durationH * 3_600_000)
      .sort((x, y) => Date.parse(x.startUtc) - Date.parse(y.startUtc))[0] ?? null
  );
}

/**
 * Următorul eșantion, strict după `fromMs`, în care Soarele este vizibil după regula activă.
 * `eventMs` este momentul interpolat al apariției, când există o tranziție ascuns → vizibil.
 * Nu este un răsărit exact: precizia este de un pas de eșantionare.
 */
export function nextSunVisible(track: SiteTrack | null, fromMs: number): { ms: number; approx: boolean } | null {
  if (!track) return null;
  const seg = track.segs.find((g) => g.endMs > fromMs && (g.state === 'both' || g.state === 'sun'));
  if (!seg) return null;
  if (seg.startMs <= fromMs) return null; // Soarele este deja vizibil
  const ev = track.events.find((e) => e.body === 'sun' && e.kind === 'rise' && Math.abs(e.ms - seg.startMs) < 1);
  return { ms: seg.startMs, approx: ev?.approx ?? true };
}
