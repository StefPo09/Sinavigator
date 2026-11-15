import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Bundle } from '../src/lib/data/types.ts';
import { buildQuiz, points } from '../src/lib/logic/quiz.ts';

const bundle: Bundle = JSON.parse(readFileSync(new URL('../public/data/bundle.json', import.meta.url), 'utf8'));

test('quiz questions are well formed and data questions match the computed results', () => {
  const qs = buildQuiz(bundle);
  assert.ok(qs.length >= 5);
  for (const q of qs) {
    assert.ok(q.options.length >= 2 && q.options.length <= 4, q.id);
    assert.ok(q.correct >= 0 && q.correct < q.options.length, q.id);
    assert.equal(new Set(q.options).size, q.options.length, q.id);
  }
  const a17 = qs.find((q) => q.id === 'fit-apollo17_72')!;
  assert.match(a17.options[a17.correct], /Sun never rises/);
  const a15 = qs.find((q) => q.id === 'fit-apollo15_72');
  if (a15) assert.equal(a15.options[a15.correct], 'Yes, it fits');
  const cmp = qs.find((q) => q.id.startsWith('compare-'));
  if (cmp) assert.equal(cmp.options[cmp.correct], 'Apollo 15');
});

test('points reward correct and fast answers', () => {
  assert.equal(points(false, 20_000, 20_000, 3), 0);
  assert.equal(points(true, 20_000, 20_000, 1), 1000);
  assert.equal(points(true, 0, 20_000, 1), 500);
  assert.equal(points(true, 10_000, 20_000, 3), 950);
});

test('the quiz asks only about what the tutorial and the site panels show', () => {
  const taught = /^(fit-|terrain-|compare-|mission-why$|band-green$|band-blue$|site-place$|terrain$|azimuth$)/;
  const qs = buildQuiz(bundle);
  for (const q of qs) assert.match(q.id, taught, q.id);
  const place = qs.find((q) => q.id === 'site-place');
  if (place) assert.equal(place.options[place.correct], 'Taurus–Littrow valley');
});
