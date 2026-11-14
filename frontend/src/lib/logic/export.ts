// Evidence export: what is on screen, plus the inputs and labels needed to reproduce or question it.

import type { Bundle } from '../data/types.ts';
import type { Side } from '../../components/zone/ScenarioCards.tsx';
import type { Fit, Model, Segment } from './derive.ts';
import { RANKING_RULE, type AltOption } from './recommend.ts';

const iso = (ms: number) => new Date(Math.round(ms)).toISOString();

export function buildExport(p: { bundle: Bundle; origin: 'file' | 'fixture'; model: Model; activityMin: number; sides: Side[]; fits: Fit[]; options: AltOption[]; readyFromMs: number }) {
  const { bundle, sides, fits } = p;
  const synthetic = bundle.provenance === 'fixture';
  const seg = (s: Side, g: Segment | null) =>
    g && { startUtc: iso(s.t0 + g.start * 60_000), endUtc: iso(s.t0 + g.end * 60_000), minutes: +(g.end - g.start).toFixed(2), truncatedStart: g.truncStart, truncatedEnd: g.truncEnd };
  return {
    tool: 'Lunar Horizon Compare',
    exportedAt: new Date().toISOString(),
    label: synthetic ? 'SYNTHETIC DEMONSTRATION DATA — not SPICE or DEM results; not a mission recommendation' : 'Computed data as declared by the loaded file',
    dataStatus: {
      provenance: bundle.provenance,
      origin: p.origin === 'fixture' ? 'built-in synthetic fixture' : 'public/data/bundle.json',
      note: bundle.note,
      generatedAt: bundle.generatedAt,
      layers: bundle.layers ?? 'not declared',
      validation: bundle.validation ?? 'no validation record',
    },
    configuration: {
      activityMinutes: p.activityMin,
      horizonModel: p.model === 'ideal' ? 'idealized 0° horizon' : 'terrain profile',
      rules: bundle.rules,
      visibility: 'Sun: margin > sunMarginDeg; Earth: margin ≥ earthMarginDeg; margin = elevation of body center − terrain angle in its direction',
      cursorSynchronization: 'elapsed time from each scenario start',
    },
    assumptions: [
      ...(bundle.assumptions ?? []),
      'Airless geometry: no atmospheric refraction.',
      'Body-center visibility convention.',
      'Transitions interpolated linearly between samples; intervals intersected per body; precision about one sample step.',
      'Missing samples are unknown, never hidden or zero.',
      'Visible Sun ≠ electrical power or thermal safety; visible Earth ≠ guaranteed radio link.',
    ],
    scenarios: sides.map((s, i) => ({
      role: s.id,
      scenarioId: s.sc.id,
      site: s.site,
      startUtc: s.sc.startUtc,
      analyzedPeriod: { startUtc: s.sc.startUtc, endUtc: iso(s.t0 + s.an.totalMin * 60_000), stepMin: s.sc.stepMin },
      terrainProfile: p.model === 'terrain' ? (s.profile ?? null) : 'not used (idealized horizon)',
      verdict: fits[i].kind,
      firstQualifyingWindow: seg(s, fits[i].first),
      spareMinutes: fits[i].first ? +fits[i].spareMin.toFixed(2) : null,
      longestKnownJointWindow: seg(s, fits[i].longest),
      intervals: {
        both: s.an.segs.both.map((g) => ({ state: g.state, ...seg(s, g) })),
        sun: s.an.segs.sun.map((g) => ({ state: g.state, ...seg(s, g) })),
        earth: s.an.segs.earth.map((g) => ({ state: g.state, ...seg(s, g) })),
      },
    })),
    alternatives: {
      label: synthetic ? 'demo suggestion (synthetic data)' : bundle.validation?.status === 'validated' ? 'computed, validated data' : 'computed, not validated',
      requestedStartUtc: iso(p.readyFromMs),
      rule: RANKING_RULE,
      options: p.options.slice(0, 5).map((o) => ({
        scenarioId: o.scenario.id,
        siteId: o.siteId,
        windowStartUtc: iso(o.startMs),
        windowEndUtc: iso(o.endMs),
        minutes: +o.lengthMin.toFixed(2),
        spareMinutes: +o.spareMin.toFixed(2),
        truncatedEnd: o.truncatedEnd,
      })),
    },
  };
}
