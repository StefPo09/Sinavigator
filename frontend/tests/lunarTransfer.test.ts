import assert from 'node:assert/strict';
import test from 'node:test';
import { moonGeocentric, sunGeocentric } from '../src/lib/logic/ephemeris.ts';
import { nextLunarTransfer, transferFrame } from '../src/lib/logic/lunarTransfer.ts';

const DAY = 86_400_000;
const started = Date.UTC(2026, 10, 14);
const angleError = (actual: number, target: number) =>
  Math.abs(((actual - target + 540) % 360) - 180);

test('estimates the first upcoming sunward departure for the moving lunar target', () => {
  const transfer = nextLunarTransfer(started);
  assert.ok(transfer);
  assert.ok(transfer.departureMs >= started && transfer.departureMs < started + 31 * DAY);
  const coastDays = (transfer.arrivalMs - transfer.departureMs) / DAY;
  assert.ok(coastDays > 4 && coastDays < 6);
  const arrivalMoon = moonGeocentric(transfer.arrivalMs);
  const departureSun = sunGeocentric(transfer.departureMs);
  assert.ok(angleError(arrivalMoon.lonDeg, departureSun.lonDeg + 180) < 0.001);
  assert.ok(angleError(moonGeocentric(transfer.departureMs).lonDeg, arrivalMoon.lonDeg) > 40);
  const following = nextLunarTransfer(transfer.departureMs + 60_000);
  assert.ok(following && following.departureMs > transfer.departureMs + 25 * DAY);
});

test('the curve starts in the parking orbit and reaches the projected near edge of the Moon', () => {
  const transfer = nextLunarTransfer(started)!;
  const start = transferFrame(transfer, 0);
  const end = transferFrame(transfer, 1);
  const latitudeFactor = Math.cos(transfer.encounter.latDeg * Math.PI / 180);
  assert.ok(Math.abs(start.craft[0] + 6578.137 * latitudeFactor) < 0.01);
  assert.ok(Math.abs(start.craft[1]) < 0.01);
  assert.ok(Math.abs(end.moon[0] - end.craft[0] - 1737.4 * latitudeFactor) < 0.01);
  assert.ok(Math.abs(end.moon[1] - end.craft[1]) < 0.01);
  const firstLeg = transferFrame(transfer, 0.1).craft[0] - start.craft[0];
  const finalLeg = end.craft[0] - transferFrame(transfer, 0.9).craft[0];
  assert.ok(firstLeg > finalLeg);
});
