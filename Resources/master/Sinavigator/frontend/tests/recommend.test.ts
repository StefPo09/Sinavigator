import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Scenario } from '@/lib/data/types.ts';
import { analyse, type Analysis } from '@/lib/logic/derive.ts';
import { findOptions } from '@/lib/logic/recommend.ts';

const STEP = 60;
const H = 3_600_000;
const T0 = Date.UTC(2026, 11, 1);

/** Hourly samples; both bodies visible exactly where `on` is 1. */
function sc(id: string, siteId: string, startH: number, on: number[]): Scenario {
  const el = on.map((v) => (v ? 5 : -5));
  return {
    id,
    siteId,
    startUtc: new Date(T0 + startH * H).toISOString(),
    durationH: on.length - 1,
    stepMin: STEP,
    sun: { azDeg: on.map(() => 0), elDeg: el },
    earth: { azDeg: on.map(() => 0), elDeg: on.map(() => 5) },
  };
}

function setup(list: Scenario[]) {
  const m = new Map<string, Analysis>();
  for (const s of list) m.set(s.id, analyse(s, undefined, 'ideal', { sunMarginDeg: 0, earthMarginDeg: 0 }));
  return m;
}

test('ranks qualifying windows by earliest UTC start, not by length', () => {
  const early = sc('A24', 'A', 24, [0, 1, 1, 1, 0, 0, 0]); // ≈ 2 h window starting ≈ +24.5 h
  const long = sc('B24', 'B', 24, [0, 0, 0, 1, 1, 1, 1]); // longer window, later start
  const list = [long, early];
  const opts = findOptions(list, setup(list), T0 + 24 * H, 90);
  assert.equal(opts[0].scenario.id, 'A24');
  assert.equal(opts[1].scenario.id, 'B24');
  assert.ok(opts[1].lengthMin > opts[0].lengthMin);
});

test('ignores scenarios that start before the requested start and windows that are too short', () => {
  const before = sc('A0', 'A', 0, [1, 1, 1, 1, 1, 1, 1]);
  const short = sc('A24', 'A', 24, [0, 1, 0, 0, 0, 0, 0]);
  const list = [before, short];
  assert.deepEqual(findOptions(list, setup(list), T0 + 24 * H, 90), []);
});

test('unknown data never becomes a recommendation', () => {
  const s = sc('A24', 'A', 24, [1, 1, 1, 1, 1, 1, 1]);
  s.earth.elDeg = [5, 5, null, null, null, 5, 5];
  const opts = findOptions([s], setup([s]), T0 + 24 * H, 180);
  assert.deepEqual(opts, []);
});
