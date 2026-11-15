import assert from 'node:assert/strict';
import test from 'node:test';
import { moonGeocentric } from '../src/lib/logic/ephemeris.ts';
import { parseHorizonsObserver, seriesEphemeris } from '../src/lib/logic/ephemerisSeries.ts';
import { nextLunarTransfer } from '../src/lib/logic/lunarTransfer.ts';

// Rows as returned by Horizons (Moon, geocentric, QUANTITIES='20,31', CSV)
const SAMPLE = ` Date__(UT)__HR:MN, , ,            delta,     deldot,     ObsEcLon,   ObsEcLat,
$$SOE
 2026-Nov-15 00:00, , , 0.00270582095749, -0.0163153,  295.3701754, -2.5070085,
 2026-Nov-15 01:00, , , 0.00270542141676, -0.0168878,  295.8620855, -2.4694154,
$$EOE
`;

test('parses a Horizons observer table into UTC times and [lon, lat, km] rows', () => {
  const { times, rows } = parseHorizonsObserver(SAMPLE);
  assert.deepEqual(times, [Date.UTC(2026, 10, 15, 0), Date.UTC(2026, 10, 15, 1)]);
  assert.equal(rows[0][0], 295.3701754);
  assert.equal(rows[0][1], -2.5070085);
  assert.ok(Math.abs(rows[0][2] - 404_785) < 5);
});

test('rejects a response without an ephemeris block', () => {
  assert.throws(() => parseHorizonsObserver('No ephemeris for target'));
});

test('interpolates across 360° and falls back to the analytic model outside the series', () => {
  const start = Date.UTC(2026, 10, 15);
  const eph = seriesEphemeris({
    source: 'test',
    startMs: start,
    stepMs: 3_600_000,
    moon: [
      [359.5, 1, 400_000],
      [0.5, 2, 401_000],
    ],
    sun: [
      [10, 0, 1.5e8],
      [11, 0, 1.5e8],
    ],
  });
  const mid = eph.moon(start + 1_800_000);
  assert.ok(Math.abs(mid.lonDeg - 0) < 1e-9 || Math.abs(mid.lonDeg - 360) < 1e-9);
  assert.equal(mid.latDeg, 1.5);
  assert.equal(mid.distKm, 400_500);
  const outside = start + 10 * 86_400_000;
  assert.deepEqual(eph.moon(outside), moonGeocentric(outside));
});

test('the transfer window can be computed from a sampled series', () => {
  const start = Date.UTC(2026, 10, 14);
  const hours = 46 * 24;
  const rows = (f: (ms: number) => { lonDeg: number; latDeg: number; distKm: number }) =>
    Array.from({ length: hours }, (_, i) => {
      const p = f(start + i * 3_600_000);
      return [p.lonDeg, p.latDeg, p.distKm] as [number, number, number];
    });
  const analytic = nextLunarTransfer(start)!;
  const eph = seriesEphemeris({ source: 'sampled analytic', startMs: start, stepMs: 3_600_000, moon: rows(moonGeocentric), sun: rows((ms) => ({ lonDeg: (280.46 + 0.9856474 * ((ms - Date.UTC(2000, 0, 1, 12)) / 86_400_000)) % 360, latDeg: 0, distKm: 1.496e8 })) });
  const sampled = nextLunarTransfer(start, eph)!;
  assert.equal(sampled.eph, eph);
  // a coarser Sun model moves the window by hours, not days
  assert.ok(Math.abs(sampled.departureMs - analytic.departureMs) < 12 * 3_600_000);
});
