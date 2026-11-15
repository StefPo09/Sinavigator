import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Bundle, Scenario } from '../src/lib/data/types.ts';
import { analyse, assessFit, type Analysis } from '../src/lib/logic/derive.ts';
import { angleDiff, cardinal, conclusion, expectedAnswer, limitingWhy, nextSunVisible, siteTrack, whyAt } from '../src/lib/logic/lesson.ts';

const bundle: Bundle = JSON.parse(readFileSync(new URL('../public/data/bundle.json', import.meta.url), 'utf8'));
const profile = (id: string) => bundle.profiles.find((p) => p.siteId === id);
const scen = (id: string) => bundle.scenarios.find((s) => s.id === id)!;
const an = (id: string, model: 'terrain' | 'ideal' = 'terrain') => analyse(scen(id), profile(scen(id).siteId), model, bundle.rules);

test('circular angles and cardinal names', () => {
  assert.equal(angleDiff(350, 10), -20);
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(cardinal(359), 'N');
  assert.equal(cardinal(270), 'W');
});

test('expected answer keeps unknown separate from "does not fit"', () => {
  const f = (kind: 'fits' | 'none' | 'insufficient') => ({ kind, first: null, spareMin: 0, longest: null, openAtEnd: false });
  assert.equal(expectedAnswer(f('fits'), f('fits')), 'both');
  assert.equal(expectedAnswer(f('none'), f('fits')), 'B');
  assert.equal(expectedAnswer(f('none'), f('none')), 'none');
  assert.equal(expectedAnswer(f('none'), f('insufficient')), 'insufficient');
});

test('conclusion sentences come from computed windows', () => {
  const a = an('apollo15_72');
  const c = conclusion(a, Date.parse(scen('apollo15_72').startUtc), assessFit(a, 120), 120);
  assert.equal(c.kind, 'fits');
  assert.match(c.text, /The 2 h activity fits/);
  assert.match(c.text, /at least/); // the window touches the start of the analyzed period
  const night = an('apollo17_72');
  const n = conclusion(night, Date.parse(scen('apollo17_72').startUtc), assessFit(night, 120), 120);
  assert.equal(n.kind, 'none');
  assert.match(n.text, /does not fit/);
});

test('why: night at Apollo 17 on 30 Nov is below the ideal horizon, not a terrain effect', () => {
  const a = an('apollo17_72');
  const w = limitingWhy(a, 'terrain', assessFit(a, 120))!;
  assert.equal(w.body, 'sun');
  assert.equal(w.kind, 'below-ideal');
  assert.ok(w.el! < 0);
});

test('why: terrain explanation only when elevation is positive but under the profile', () => {
  const a = an('apollo17_0');
  // first sample after the terrain sunset: the Sun is still above 0° but under the massif
  const set = a.sun.transitions.find((t) => t.to === 'hid')!;
  const w = whyAt(a, 'terrain', 'sun', set.t);
  assert.equal(w.kind, 'terrain');
  assert.ok(w.el! >= 0 && w.el! < w.hor!);
  assert.match(w.text, /the terrain hides it/);
  // with the idealized horizon the same sample is still sunlit
  assert.equal(whyAt(an('apollo17_0', 'ideal'), 'ideal', 'sun', set.t).kind, 'visible');
});

test('site track stitches scenarios without overlap and finds the next sunlit sample', () => {
  const analyses = new Map<string, Analysis>(bundle.scenarios.map((s) => [s.id, analyse(s, profile(s.siteId), 'terrain', bundle.rules)]));
  const tr = siteTrack(bundle.scenarios, analyses, 'apollo17')!;
  for (let i = 1; i < tr.segs.length; i++) assert.ok(tr.segs[i].startMs >= tr.segs[i - 1].endMs - 1);
  assert.equal(tr.startMs, Date.parse('2026-11-27T00:00:00Z'));
  assert.equal(tr.endMs, Date.parse('2026-12-03T00:00:00Z'));
  // Apollo 17 stays dark until the end of the data: no sunlit sample after the sunset
  const set = tr.events.find((e) => e.body === 'sun' && e.kind === 'set')!;
  assert.equal(nextSunVisible(tr, set.ms + 60_000), null);
  // before the sunset the Sun is already visible: no "next" sunlit sample is proposed
  assert.equal(nextSunVisible(tr, set.ms - 3_600_000), null);
});

test('next sunlit sample after a synthetic night', () => {
  const on = [1, 1, 0, 0, 1, 1];
  const sc: Scenario = { id: 'x', siteId: 's', startUtc: '2026-12-01T00:00:00Z', durationH: 5, stepMin: 60, sun: { azDeg: on.map(() => 90), elDeg: on.map((v) => (v ? 5 : -5)) }, earth: { azDeg: on.map(() => 0), elDeg: on.map(() => 30) } };
  const analyses = new Map([[sc.id, analyse(sc, undefined, 'ideal', { sunMarginDeg: 0, earthMarginDeg: 2 })]]);
  const tr = siteTrack([sc], analyses, 's')!;
  const next = nextSunVisible(tr, Date.parse('2026-12-01T02:00:00Z'))!;
  assert.equal(next.ms, Date.parse('2026-12-01T03:30:00Z')); // interpolated between 03:00 and 04:00
  assert.equal(next.approx, true);
});
