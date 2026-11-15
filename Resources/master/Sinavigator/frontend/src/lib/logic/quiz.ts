// Timed quiz questions. Data questions are computed from the loaded Bundle with the same rules
// as the rest of the atlas (terrain horizon); concept questions check the lesson's key ideas.

import type { Bundle, Scenario } from '../data/types.ts';
import { analyse, assessFit, closingCause, windowLen, type Analysis, type Model } from './derive.ts';
import { fmtDur, fmtUtcMs } from './format.ts';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  /** shown after answering: why the right answer is right, with computed values */
  explain: string;
  /** computed from data (true) or a concept check (false) */
  fromData: boolean;
}

const shortName = (b: Bundle, siteId: string) => b.sites.find((s) => s.id === siteId)?.short ?? siteId;

function scenarioFor(b: Bundle, siteId: string, startMs: number): Scenario | undefined {
  return b.scenarios.find((s) => s.siteId === siteId && Date.parse(s.startUtc) === startMs);
}

function analysisOf(b: Bundle, sc: Scenario, model: Model): Analysis {
  return analyse(sc, b.profiles.find((p) => p.siteId === sc.siteId), model, b.rules);
}

/** Moves the correct answer to a stable but not always-first position. */
function place(options: string[], correctText: string, seed: number): { options: string[]; correct: number } {
  const others = options.filter((o) => o !== correctText);
  const at = seed % (others.length + 1);
  const out = [...others.slice(0, at), correctText, ...others.slice(at)];
  return { options: out, correct: at };
}

/** Does a 2 h activity fit at a site for the latest start in the data? */
function fitQuestion(b: Bundle, siteId: string, startMs: number, activityMin: number): QuizQuestion | null {
  const sc = scenarioFor(b, siteId, startMs);
  if (!sc) return null;
  const an = analysisOf(b, sc, 'terrain');
  const fit = assessFit(an, activityMin);
  const site = shortName(b, siteId);
  const sunHidden = an.sun.state.every((s) => s === 'hid');
  const earthHidden = an.earth.state.every((s) => s === 'hid');
  const yes = 'Yes, it fits';
  const noSun = 'No: the Sun never rises above the local horizon';
  const noEarth = 'No: the Earth stays hidden';
  const unknown = 'Not enough data to tell';
  let correctText: string;
  let explain: string;
  if (fit.kind === 'fits' && fit.first) {
    correctText = yes;
    explain = `Sun and Earth are visible together for at least ${fmtDur(windowLen(fit.first))} starting ${fmtUtcMs(Date.parse(sc.startUtc) + fit.first.start * 60_000)}, so ${fmtDur(activityMin)} fits.`;
  } else if (fit.kind === 'insufficient') {
    correctText = unknown;
    explain = 'Some samples are missing, and the gap could hide a long enough window.';
  } else if (sunHidden) {
    correctText = noSun;
    explain = `At ${site} the Sun stays below the horizon for the whole period (${fmtUtcMs(Date.parse(sc.startUtc))} → ${fmtUtcMs(Date.parse(sc.startUtc) + an.totalMin * 60_000)}): it is lunar night. The Earth is up, but the activity also needs sunlight.`;
  } else if (earthHidden) {
    correctText = noEarth;
    explain = `At ${site} the Earth is not visible in this period, so there is no common window.`;
  } else {
    correctText = 'No: the common window is too short';
    explain = `The longest common window is only ${fmtDur(windowLen(fit.longest))}.`;
  }
  const base = [yes, noSun, noEarth, unknown];
  const options = base.includes(correctText) ? base : [yes, noSun, correctText, unknown];
  const placed = place(options, correctText, 2);
  return {
    id: `fit-${sc.id}`,
    prompt: `A rover task needs ${fmtDur(activityMin)} with both the Sun and the Earth visible. Does it fit at ${site} in the period starting ${fmtUtcMs(startMs).replace(', 00:00 UTC', '')}?`,
    ...placed,
    explain,
    fromData: true,
  };
}

/** How much earlier the Sun disappears because of terrain (terrain vs ideal 0° horizon). */
function terrainQuestion(b: Bundle, siteId: string, startMs: number): QuizQuestion | null {
  const sc = scenarioFor(b, siteId, startMs);
  if (!sc) return null;
  const set = (m: Model) => analysisOf(b, sc, m).sun.transitions.find((t) => t.to === 'hid')?.t ?? null;
  const tTerrain = set('terrain');
  const tIdeal = set('ideal');
  if (tTerrain == null || tIdeal == null || tIdeal - tTerrain < 15) return null;
  const diff = tIdeal - tTerrain;
  const right = `About ${fmtDur(Math.round(diff / 10) * 10)} earlier`;
  const opts = [right, `About ${fmtDur(Math.round(diff / 40) * 10)} earlier`, `About ${fmtDur(Math.round((diff * 2.5) / 10) * 10)} earlier`, 'No difference: terrain does not matter'];
  const site = shortName(b, siteId);
  return {
    id: `terrain-${sc.id}`,
    prompt: `At ${site}, how much earlier does the Sun disappear when you count the real terrain instead of a flat 0° horizon?`,
    ...place(opts, right, 1),
    explain: `With terrain the Sun sets at ≈ ${fmtUtcMs(Date.parse(sc.startUtc) + tTerrain * 60_000)}; with a flat horizon at ≈ ${fmtUtcMs(Date.parse(sc.startUtc) + tIdeal * 60_000)}. The valley walls hide the low Sun earlier (events are interpolated, ± one 10-min step).`,
    fromData: true,
  };
}

/** Which site keeps the Sun and Earth together longer from the same start? */
function compareQuestion(b: Bundle, startMs: number): QuizQuestion | null {
  const list = b.scenarios.filter((s) => Date.parse(s.startUtc) === startMs);
  if (list.length < 2) return null;
  const [x, y] = list;
  const lx = windowLen(analysisOf(b, x, 'terrain').longest);
  const ly = windowLen(analysisOf(b, y, 'terrain').longest);
  const nx = shortName(b, x.siteId);
  const ny = shortName(b, y.siteId);
  const same = 'Both the same';
  const right = Math.abs(lx - ly) < 10 ? same : lx > ly ? nx : ny;
  const cause = (sc: Scenario) => {
    const an = analysisOf(b, sc, 'terrain');
    if (!an.longest) return 'no common window';
    const c = closingCause(an, an.longest);
    return c.kind === 'period-end' ? 'still open at the end of the data' : `ends ≈ ${fmtUtcMs(Date.parse(sc.startUtc) + c.t * 60_000)}`;
  };
  return {
    id: `compare-${startMs}`,
    prompt: `Starting ${fmtUtcMs(startMs).replace(', 00:00 UTC', '')}, which site keeps the Sun and Earth visible together for longer?`,
    ...place([nx, ny, same], right, 0),
    explain: `${nx}: ${fmtDur(lx)} (${cause(x)}). ${ny}: ${fmtDur(ly)} (${cause(y)}).`,
    fromData: true,
  };
}

const CONCEPTS: QuizQuestion[] = [
  {
    id: 'phase',
    prompt: 'From Earth the Moon looks almost full. Does that mean it is daytime at every landing site?',
    options: ['Yes, a full Moon means sunlight everywhere', 'No: local daylight depends on the Sun being above that site’s horizon', 'Only on the far side', 'Only at the poles'],
    correct: 1,
    explain: 'The phase is what we see from Earth. A site can still be in night if the Sun is below its local horizon.',
    fromData: false,
  },
  {
    id: 'azimuth',
    prompt: 'The Sun is at azimuth 270°. Where should you look?',
    options: ['North', 'East', 'South', 'West'],
    correct: 3,
    explain: 'Azimuth is measured from north towards east: 0° N, 90° E, 180° S, 270° W.',
    fromData: false,
  },
  {
    id: 'radio',
    prompt: 'The Earth is above the horizon. Is a radio link guaranteed?',
    options: ['Yes, always', 'No: this is only geometry, not a link budget', 'Only at night', 'Only with the Sun visible'],
    correct: 1,
    explain: 'Line of sight is necessary but not sufficient: antennas, power and the network are not modelled.',
    fromData: false,
  },
  {
    id: 'terrain',
    prompt: 'The Sun is 3° above a flat horizon, but a ridge in that direction rises to 5°. Can you see the Sun?',
    options: ['Yes', 'No: the terrain hides it', 'Only half of it', 'It depends on the Earth'],
    correct: 1,
    explain: 'Visibility uses the margin: elevation − terrain angle = 3° − 5° = −2°, so the ridge blocks the Sun.',
    fromData: false,
  },
];

export function buildQuiz(b: Bundle, activityMin = 120): QuizQuestion[] {
  const starts = [...new Set(b.scenarios.map((s) => Date.parse(s.startUtc)))].sort((x, y) => x - y);
  const first = starts[0];
  const last = starts[starts.length - 1];
  const sites = [...new Set(b.scenarios.map((s) => s.siteId))];
  const data = [
    ...sites.map((id) => fitQuestion(b, id, last, activityMin)),
    ...sites.map((id) => terrainQuestion(b, id, first)).slice(0, 1),
    compareQuestion(b, last),
  ].filter((q): q is QuizQuestion => q != null);
  // alternate data and concept questions
  const out: QuizQuestion[] = [];
  const concepts = [...CONCEPTS];
  for (let i = 0; out.length < 7 && (data.length || concepts.length); i++) {
    const next = i % 2 === 0 ? (concepts.shift() ?? data.shift()) : (data.shift() ?? concepts.shift());
    if (next) out.push(next);
  }
  return out;
}

/** Points: up to 1000 for a fast correct answer, at least 500; streak bonus 100 per extra in a row. */
export function points(correct: boolean, remainingMs: number, limitMs: number, streak: number): number {
  if (!correct) return 0;
  const speed = Math.max(0, Math.min(1, remainingMs / limitMs));
  return Math.round(500 + 500 * speed) + Math.max(0, streak - 1) * 100;
}

export const QUIZ_TIME_MS = 20_000;
