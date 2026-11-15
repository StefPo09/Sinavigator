// Verifică modelul analitic aproximativ folosit DOAR în scena schematică a sistemului.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moonGeocentric, moonPhase, sunGeocentric } from '../src/lib/logic/ephemeris.ts';

test('Soarele este la ~0° longitudine la echinocțiul din 20 mar 2025, 09:01 UTC', () => {
  const lon = sunGeocentric(Date.UTC(2025, 2, 20, 9, 1)).lonDeg;
  const d = Math.min(lon, 360 - lon);
  assert.ok(d < 0.1, `abatere ${d}°`);
});

test('Lună plină (13 ian 2025, 22:27 UTC) → diferența de longitudine Lună–Soare ≈ 180°', () => {
  const t = Date.UTC(2025, 0, 13, 22, 27);
  const d = Math.abs(((moonGeocentric(t).lonDeg - sunGeocentric(t).lonDeg + 360) % 360) - 180);
  assert.ok(d < 1, `abatere ${d}°`);
});

test('Lună nouă (29 ian 2025, 12:36 UTC) → elongație mică', () => {
  assert.ok(moonPhase(Date.UTC(2025, 0, 29, 12, 36)).elongDeg < 6);
});

test('Cerul local aproximativ: Pământul la zenit în centrul feței vizibile, la orizont la pol', async () => {
  const { approxLocalSky } = await import('../src/lib/logic/ephemeris.ts');
  const t = Date.UTC(2026, 11, 1);
  assert.ok(approxLocalSky(t, 0, 0).earth.elDeg > 88);
  assert.ok(Math.abs(approxLocalSky(t, -89.9, 0).earth.elDeg) < 2);
});

test('Cerul local aproximativ: la Lună plină, Soarele e aproape de zenit în centrul feței vizibile', async () => {
  const { approxLocalSky } = await import('../src/lib/logic/ephemeris.ts');
  assert.ok(approxLocalSky(Date.UTC(2025, 0, 13, 22, 27), 0, 0).sun.elDeg > 80);
});
