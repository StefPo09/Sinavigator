// Run with: npm test   (Node's built-in test runner; Node ≥ 23 strips TypeScript types)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Rules, Scenario } from '@/lib/data/types.ts';
import { analyse, assessFit, closingCause, type Segment } from '@/lib/logic/derive.ts';

const STEP = 10;
const rules = (earth = 0): Rules => ({ sunMarginDeg: 0, earthMarginDeg: earth });

/** Idealized horizon (0°), azimuth irrelevant. */
function sc(sunEl: (number | null)[], earthEl: (number | null)[]): Scenario {
  const n = sunEl.length;
  return {
    id: 't',
    siteId: 'X',
    startUtc: '2026-12-01T00:00:00.000Z',
    offsetH: 0,
    durationH: ((n - 1) * STEP) / 60,
    stepMin: STEP,
    sun: { azDeg: Array(n).fill(0), elDeg: sunEl },
    earth: { azDeg: Array(n).fill(0), elDeg: earthEl },
  };
}
const run = (s: (number | null)[], e: (number | null)[], earthMargin = 0) => analyse(sc(s, e), undefined, 'ideal', rules(earthMargin));
const vis = (segs: Segment[]) => segs.filter((g) => g.state === 'vis').map((g) => [round(g.start), round(g.end)]);
const round = (x: number) => Math.round(x * 1000) / 1000;

test('keeps a short overlap when Sun and Earth cross in opposite directions within one step', () => {
  // Sun: +1° → −1° (sets at 5 min). Earth: −1° → +3° (rises at 2.5 min). No sample has both visible.
  const a = run([1, -1], [-1, 3]);
  assert.deepEqual(vis(a.segs.sun), [[0, 5]]);
  assert.deepEqual(vis(a.segs.earth), [[2.5, 10]]);
  assert.deepEqual(vis(a.segs.both), [[2.5, 5]]);
});

test('no overlap when the bodies are visible at different times', () => {
  const a = run([2, 2, -2, -2, -2], [-2, -2, -2, 2, 2]);
  assert.deepEqual(vis(a.segs.both), []);
  assert.equal(a.longest, null);
});

test('threshold equality: Sun needs margin > 0, Earth needs margin ≥ δ', () => {
  const sunAtZero = run([0, 0], [5, 5]);
  assert.deepEqual(vis(sunAtZero.segs.sun), []);
  const earthAtDelta = run([5, 5], [2, 2], 2);
  assert.deepEqual(vis(earthAtDelta.segs.earth), [[0, 10]]);
  const earthBelowDelta = run([5, 5], [1.99, 1.99], 2);
  assert.deepEqual(vis(earthBelowDelta.segs.earth), []);
});

test('unknown samples make the whole span to the nearest known samples unknown, not visible', () => {
  const a = run([5, 5, 5, 5, 5], [3, 3, null, 3, 3]);
  assert.deepEqual(vis(a.segs.earth), [
    [0, 10],
    [30, 40],
  ]);
  const unk = a.segs.earth.filter((g) => g.state === 'unk').map((g) => [g.start, g.end]);
  assert.deepEqual(unk, [[10, 30]]);
  assert.deepEqual(vis(a.segs.both), [
    [0, 10],
    [30, 40],
  ]);
  assert.ok(a.segs.both.some((g) => g.state === 'unk' && g.start === 10 && g.end === 30));
});

test('windows touching the analyzed period are marked truncated', () => {
  const a = run([5, 5, 5], [5, 5, 5]);
  assert.equal(a.segs.both.length, 1);
  assert.equal(a.segs.both[0].truncStart, true);
  assert.equal(a.segs.both[0].truncEnd, true);
  assert.deepEqual(closingCause(a, a.segs.both[0]), { kind: 'period-end', t: 20 });
});

test('activity fit: fits, does not fit, insufficient data', () => {
  // joint window 0–30 min, then Sun hidden
  const a = run([5, 5, 5, 5, -5, -5, -5], [5, 5, 5, 5, 5, 5, 5]);
  const fits = assessFit(a, 20);
  assert.equal(fits.kind, 'fits');
  assert.ok(fits.first && round(fits.first.end) === 35); // Sun sets halfway between 30 and 40 min
  assert.equal(round(fits.spareMin), 15);
  assert.equal(assessFit(a, 60).kind, 'none');
  assert.deepEqual(closingCause(a, a.segs.both[0]), { kind: 'body', body: 'sun', t: 35 });

  // 20 min known + 20 min unknown: a 30 min activity cannot be confirmed or rejected
  const b = run([5, 5, 5, 5, 5, -5], [5, 5, 5, null, 5, -5]);
  assert.equal(assessFit(b, 30).kind, 'insufficient');
  assert.equal(assessFit(b, 10).kind, 'fits');
});

test('the Earth closing a window is reported as the limiting body', () => {
  const a = run([5, 5, 5, 5], [5, 5, 1, 1], 2);
  const w = a.segs.both.find((g) => g.state === 'vis')!;
  assert.deepEqual(closingCause(a, w), { kind: 'body', body: 'earth', t: w.end });
});
