import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { localSkyDirection, siteSkyAt } from '../src/lib/logic/bundleEphemeris.ts';
import type { Bundle } from '../src/lib/data/types.ts';

const bundle = JSON.parse(await readFile(new URL('../public/data/bundle.json', import.meta.url), 'utf8')) as Bundle;

test('samples the fetched Apollo 17 Horizons values at their exact timestamp', () => {
  const sky = siteSkyAt(bundle, 'apollo17', Date.parse('2026-11-27T00:00:00Z'));
  assert.ok(sky);
  assert.equal(sky.scenarioId, 'apollo17_0');
  assert.equal(sky.sun.azDeg, bundle.scenarios[0].sun.azDeg[0]);
  assert.equal(sky.sun.elDeg, bundle.scenarios[0].sun.elDeg[0]);
});

test('changes the sampled Sun direction as the timeline advances', () => {
  const start = Date.parse('2026-11-27T00:00:00Z');
  const first = siteSkyAt(bundle, 'apollo17', start);
  const later = siteSkyAt(bundle, 'apollo17', start + 12 * 60 * 60_000);
  assert.ok(first && later);
  assert.ok(Math.abs(first.sun.azDeg - later.sun.azDeg) > 1);
});

test('interpolates between samples and follows the shortest azimuth path', () => {
  const custom = structuredClone(bundle);
  const scenario = custom.scenarios[0];
  scenario.sun.azDeg[0] = 359;
  scenario.sun.azDeg[1] = 1;
  scenario.sun.elDeg[0] = 10;
  scenario.sun.elDeg[1] = 20;
  const sky = siteSkyAt(custom, 'apollo17', Date.parse(scenario.startUtc) + 5 * 60_000);
  assert.ok(sky);
  assert.equal(sky.sun.azDeg, 0);
  assert.equal(sky.sun.elDeg, 15);
});

test('returns no lighting data outside the site coverage', () => {
  assert.equal(siteSkyAt(bundle, 'apollo17', Date.parse('2026-12-04T00:00:00Z')), null);
});

test('preserves a valid exact sample immediately before an unavailable sample', () => {
  const custom = structuredClone(bundle);
  const scenario = custom.scenarios[0];
  scenario.sun.elDeg[1] = null;
  const sky = siteSkyAt(custom, 'apollo17', Date.parse(scenario.startUtc));
  assert.ok(sky);
  assert.equal(sky.sun.elDeg, scenario.sun.elDeg[0]);
});

test('maps sampled local azimuth and elevation into the Moon model direction', () => {
  const lat = 20.1911 * Math.PI / 180;
  const lon = 30.7723 * Math.PI / 180;
  const direction = localSkyDirection(20.1911, 30.7723, { azDeg: 90, elDeg: 0 });
  const east = { x: -Math.sin(lon), y: 0, z: -Math.cos(lon) };
  const up = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: -Math.cos(lat) * Math.sin(lon) };
  const dotEast = direction.x * east.x + direction.y * east.y + direction.z * east.z;
  const dotUp = direction.x * up.x + direction.y * up.y + direction.z * up.z;
  assert.ok(Math.abs(dotEast - 1) < 1e-12);
  assert.ok(Math.abs(dotUp) < 1e-12);
});
