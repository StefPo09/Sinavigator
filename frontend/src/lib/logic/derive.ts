// Turns Bundle samples into visibility states, intervals, fits and transitions.
// No astronomy here: only the margin M = El − H(Az) and interval arithmetic.
//
// Interval rules (see tests/intervals.test.ts):
// - Each body gets its own intervals. A transition between two KNOWN samples is placed by linear
//   interpolation of (margin − threshold). This is approximate (precision ≈ one sample step).
// - A known state is only trusted up to the last known sample. The whole span between a known
//   sample and an unknown one is UNKNOWN — never a midpoint guess.
// - The joint (Sun AND Earth) intervals are the intersection of the per-body intervals, so a short
//   overlap between two samples is kept even when no single sample shows both bodies visible.
// - Excursions shorter than one sample step that leave no trace in the samples cannot be detected.

import type { BodySeries, HorizonProfile, Rules, Scenario } from '../data/types.ts';

export type Model = 'terrain' | 'ideal';
export type VisState = 'vis' | 'hid' | 'unk';
export type Body = 'sun' | 'earth';
export type RowKey = Body | 'both';
/** five-way state for the shared timeline: which bodies are visible */
export type Detail = 'both' | 'sun' | 'earth' | 'none' | 'unk';

export interface Segment<S = VisState> {
  state: S;
  /** minutes from the scenario start */
  start: number;
  end: number;
  /** touches the edge of the analyzed period: the real interval may be longer */
  truncStart: boolean;
  truncEnd: boolean;
}

export interface Transition {
  t: number;
  body: Body;
  from: VisState;
  to: VisState;
  /** true when placed by interpolation between two known samples */
  interpolated: boolean;
}

export interface BodyTrack {
  az: number[];
  el: (number | null)[];
  hor: (number | null)[];
  margin: (number | null)[];
  state: VisState[];
  threshold: number;
  strict: boolean;
  segs: Segment[];
  transitions: Transition[];
}

export interface Analysis {
  stepMin: number;
  n: number;
  totalMin: number;
  sun: BodyTrack;
  earth: BodyTrack;
  segs: Record<RowKey, Segment[]>;
  detail: Segment<Detail>[];
  longest: Segment | null;
}

const EPS = 1e-6;

export function horizonAt(p: HorizonProfile | undefined, azDeg: number, model: Model): number | null {
  if (model === 'ideal') return 0;
  if (!p) return null;
  const n = p.elevDeg.length;
  const x = ((((azDeg % 360) + 360) % 360) / p.stepDeg) % n;
  const i = Math.floor(x);
  const a = p.elevDeg[i];
  const b = p.elevDeg[(i + 1) % n];
  if (a == null || b == null) return null;
  return a + (b - a) * (x - i);
}

function sampleStates(s: BodySeries, p: HorizonProfile | undefined, model: Model, threshold: number, strict: boolean) {
  const hor: (number | null)[] = [];
  const margin: (number | null)[] = [];
  const state: VisState[] = [];
  for (let i = 0; i < s.azDeg.length; i++) {
    const el = s.elDeg[i];
    const az = s.azDeg[i];
    const h = az == null ? null : horizonAt(p, az, model);
    const m = el == null || h == null ? null : el - h;
    hor.push(h);
    margin.push(m);
    state.push(m == null ? 'unk' : (strict ? m > threshold : m >= threshold) ? 'vis' : 'hid');
  }
  return { hor, margin, state };
}

function mergeSegs<S>(raw: { state: S; start: number; end: number }[], total: number): Segment<S>[] {
  const out: Segment<S>[] = [];
  for (const r of raw) {
    if (r.end - r.start <= EPS) continue;
    const last = out[out.length - 1];
    if (last && last.state === r.state && Math.abs(last.end - r.start) <= EPS) last.end = r.end;
    else out.push({ state: r.state, start: r.start, end: r.end, truncStart: false, truncEnd: false });
  }
  for (const s of out) {
    s.truncStart = s.start <= EPS;
    s.truncEnd = s.end >= total - EPS;
  }
  return out;
}

/** Per-body intervals from per-sample states (exported for tests). */
export function bodySegments(state: VisState[], margin: (number | null)[], threshold: number, step: number): Segment[] {
  const n = state.length;
  const total = (n - 1) * step;
  if (n === 1) return mergeSegs([{ state: state[0], start: 0, end: 0 }], 0);
  const raw: { state: VisState; start: number; end: number }[] = [];
  let cur = state[0];
  let start = 0;
  for (let i = 0; i < n - 1; i++) {
    const s0 = state[i];
    const s1 = state[i + 1];
    if (s0 === s1) continue;
    let tc: number;
    if (s0 !== 'unk' && s1 !== 'unk') {
      const e0 = (margin[i] as number) - threshold;
      const e1 = (margin[i + 1] as number) - threshold;
      const f = e0 === e1 ? 0.5 : Math.min(1, Math.max(0, e0 / (e0 - e1)));
      tc = (i + f) * step;
    } else if (s1 === 'unk') {
      tc = i * step; // the known state is only certain up to the last known sample
    } else {
      tc = (i + 1) * step; // unknown until the next known sample
    }
    raw.push({ state: cur, start, end: tc });
    cur = s1;
    start = tc;
  }
  raw.push({ state: cur, start, end: total });
  return mergeSegs(raw, total);
}

export function stateAt<S>(segs: Segment<S>[], t: number): S {
  for (const s of segs) if (t >= s.start - EPS && t < s.end - EPS) return s.state;
  return segs[segs.length - 1].state;
}

export function segAt<S>(segs: Segment<S>[], t: number): Segment<S> {
  for (const s of segs) if (t >= s.start - EPS && t < s.end - EPS) return s;
  return segs[segs.length - 1];
}

function overlay<S>(a: Segment[], b: Segment[], total: number, f: (x: VisState, y: VisState) => S): Segment<S>[] {
  const pts = [0, total, ...a.flatMap((s) => [s.start, s.end]), ...b.flatMap((s) => [s.start, s.end])].sort((x, y) => x - y);
  const uniq: number[] = [];
  for (const p of pts) if (!uniq.length || p - uniq[uniq.length - 1] > EPS) uniq.push(p);
  const raw: { state: S; start: number; end: number }[] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const mid = (uniq[i] + uniq[i + 1]) / 2;
    raw.push({ state: f(stateAt(a, mid), stateAt(b, mid)), start: uniq[i], end: uniq[i + 1] });
  }
  return mergeSegs(raw, total);
}

export const joint = (x: VisState, y: VisState): VisState => (x === 'vis' && y === 'vis' ? 'vis' : x === 'hid' || y === 'hid' ? 'hid' : 'unk');
const detailOf = (x: VisState, y: VisState): Detail =>
  x === 'unk' || y === 'unk' ? 'unk' : x === 'vis' && y === 'vis' ? 'both' : x === 'vis' ? 'sun' : y === 'vis' ? 'earth' : 'none';

function track(s: BodySeries, p: HorizonProfile | undefined, model: Model, threshold: number, strict: boolean, step: number, body: Body): BodyTrack {
  const { hor, margin, state } = sampleStates(s, p, model, threshold, strict);
  const segs = bodySegments(state, margin, threshold, step);
  const transitions: Transition[] = [];
  for (let k = 1; k < segs.length; k++) {
    const from = segs[k - 1].state;
    const to = segs[k].state;
    transitions.push({ t: segs[k].start, body, from, to, interpolated: from !== 'unk' && to !== 'unk' });
  }
  return { az: s.azDeg, el: s.elDeg, hor, margin, state, threshold, strict, segs, transitions };
}

export function analyse(sc: Scenario, p: HorizonProfile | undefined, model: Model, rules: Rules): Analysis {
  const step = sc.stepMin;
  const sun = track(sc.sun, p, model, rules.sunMarginDeg, true, step, 'sun');
  const earth = track(sc.earth, p, model, rules.earthMarginDeg, false, step, 'earth');
  const n = sun.state.length;
  const total = (n - 1) * step;
  const both = overlay(sun.segs, earth.segs, total, joint);
  let longest: Segment | null = null;
  for (const s of both) if (s.state === 'vis' && (!longest || s.end - s.start > longest.end - longest.start)) longest = s;
  return {
    stepMin: step,
    n,
    totalMin: total,
    sun,
    earth,
    segs: { sun: sun.segs, earth: earth.segs, both },
    detail: overlay(sun.segs, earth.segs, total, detailOf),
    longest,
  };
}

export const windowLen = (s: Segment | null | undefined) => (s ? s.end - s.start : 0);

/* ───────────── activity fit ───────────── */

export type FitKind = 'fits' | 'insufficient' | 'none';
export interface Fit {
  kind: FitKind;
  /** earliest known joint window long enough for the activity */
  first: Segment | null;
  spareMin: number;
  longest: Segment | null;
  /** a joint window is still open when the analyzed period ends */
  openAtEnd: boolean;
}

export function assessFit(a: Analysis, activityMin: number): Fit {
  const both = a.segs.both;
  const first = both.find((s) => s.state === 'vis' && s.end - s.start >= activityMin - EPS) ?? null;
  const last = both[both.length - 1];
  const openAtEnd = last.state === 'vis' && last.truncEnd;
  if (first) return { kind: 'fits', first, spareMin: first.end - first.start - activityMin, longest: a.longest, openAtEnd };
  // no known window fits: could an unknown span hide one?
  let runStart: number | null = null;
  let hasUnk = false;
  let insufficient = false;
  for (const s of [...both, { state: 'hid' as VisState, start: a.totalMin, end: a.totalMin }]) {
    if (s.state === 'hid') {
      runStart = null;
      hasUnk = false;
    } else {
      runStart ??= s.start;
      if (s.state === 'unk') hasUnk = true;
    }
  }
  return { kind: insufficient ? 'insufficient' : 'none', first: null, spareMin: 0, longest: a.longest, openAtEnd };
}

/* ───────────── causes and events ───────────── */

export type Cause =
  | { kind: 'body'; body: Body | 'both'; t: number }
  | { kind: 'unknown'; body: Body | 'both'; t: number }
  | { kind: 'period-end'; t: number };

/** Why a joint window ends: which body leaves, data becomes unknown, or the analyzed period ends. */
export function closingCause(a: Analysis, seg: Segment): Cause {
  if (seg.truncEnd) return { kind: 'period-end', t: seg.end };
  const t = seg.end + 1e-4;
  const s = stateAt(a.sun.segs, t);
  const e = stateAt(a.earth.segs, t);
  if (s === 'hid' || e === 'hid') return { kind: 'body', body: s === 'hid' && e === 'hid' ? 'both' : s === 'hid' ? 'sun' : 'earth', t: seg.end };
  return { kind: 'unknown', body: s === 'unk' && e === 'unk' ? 'both' : s === 'unk' ? 'sun' : 'earth', t: seg.end };
}

export interface NextEvent {
  state: VisState;
  /** minutes until the next change; null = no change in the analyzed period */
  inMin: number | null;
  nextState: VisState | null;
}

export function nextEvent(segs: Segment[], t: number): NextEvent {
  const i = segs.indexOf(segAt(segs, t));
  const s = segs[i];
  if (i === segs.length - 1) return { state: s.state, inMin: null, nextState: null };
  return { state: s.state, inMin: s.end - t, nextState: segs[i + 1].state };
}

export const allTransitions = (a: Analysis) => [...a.sun.transitions, ...a.earth.transitions].sort((x, y) => x.t - y.t);

/** Sample index shown for a cursor time: the first sample at or after the time. */
export const sampleIndex = (a: Analysis, t: number) => Math.min(a.n - 1, Math.max(0, Math.round(t / a.stepMin)));

/** Cursor position (on the sample grid) used to show an event: the first sample after it. */
export const seekTime = (a: Analysis, t: number) => Math.min(a.totalMin, Math.ceil(t / a.stepMin - EPS) * a.stepMin);
