import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Bundle } from '@/lib/data/types.ts';
import { validateBundle } from '@/lib/data/validate.ts';
import { analyse, assessFit } from '@/lib/logic/derive.ts';
import { catalog, defaults, find } from '@/lib/logic/scenarios.ts';

const bundle: Bundle = JSON.parse(readFileSync(new URL('../public/data/bundle.json', import.meta.url), 'utf8'));

test('the shipped data compares both Apollo sites at the same UTC start', () => {
  assert.deepEqual(validateBundle(bundle).errors, []);
  assert.deepEqual(bundle.sites.map((site) => site.id), ['apollo17', 'apollo15']);
  assert.equal(bundle.provenance, 'computed');
  const cat = catalog(bundle);
  const plans = defaults(cat);
  const a = find(cat, plans.a);
  const b = find(cat, plans.b);
  assert.equal(a?.siteId, 'apollo17');
  assert.equal(b?.siteId, 'apollo15');
  assert.equal(a?.startUtc, b?.startUtc);
});

test('the measured inputs produce different illumination windows at the two sites', () => {
  const cat = catalog(bundle);
  const { a, b } = defaults(cat);
  const compare = (scenario: NonNullable<ReturnType<typeof find>>) => {
    const profile = bundle.profiles.find((p) => p.siteId === scenario.siteId);
    assert.ok(profile);
    assert.ok(profile.elevDeg.every((elevation) => elevation != null));
    return assessFit(analyse(scenario, profile, 'terrain', bundle.rules), 120);
  };
  const first = compare(find(cat, a)!);
  const second = compare(find(cat, b)!);
  assert.ok(first.kind === 'fits' && second.kind === 'fits');
  assert.ok(first.first && second.first);
  assert.ok(first.first.end < second.first.end);
  assert.equal(second.first.truncEnd, true);
});
