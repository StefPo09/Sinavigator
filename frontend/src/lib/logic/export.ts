// Evidence export: what is on screen, plus the inputs and labels needed to reproduce or question it.

import type { Bundle } from '../data/types.ts';
import type { Side } from '../../components/zone/ScenarioCards.tsx';
import type { Fit, Model, Segment } from './derive.ts';
import { RANKING_RULE, type AltOption } from './recommend.ts';

/** Kept in sync with the in-app disclosure (EvidenceDetails.AI_DISCLOSURE). */
const AI_DISCLOSURE = 'AI tools used in development: DeepSeek V4.1 Flash (1017), and Claude (Anthropic, through Claude Code) for parts of the interface code; all generated code was reviewed and tested by the team. In-app explanations are template sentences filled with computed values; no language model runs in the app.';

const RESOURCE_SOURCES = [
  { name: 'LROC QuickMap', url: 'https://quickmap.lroc.asu.edu/', role: 'Map context and terrain/image-product inspection.' },
  { name: 'NASA Moon Trek', url: 'https://trek.nasa.gov/moon/', role: 'Lunar map and surface-layer context.' },
  { name: 'Canadian Space Agency — Moon exploration', url: 'https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/', role: 'Educational mission-planning context.' },
  { name: 'NASA/JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/', role: 'Sun and Earth ephemerides used by the computed geometry layer.' },
  { name: 'LROC coordinates of the Apollo modules', url: 'https://lroc.im-ldi.com/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf', role: 'Landing-site coordinates.' },
  { name: 'LROC Apollo 17 terrain model', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO17', role: 'Regional Taurus–Littrow terrain reference.' },
  { name: 'LROC Apollo 15 terrain model', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO15', role: 'Regional Hadley–Apennine terrain reference.' },
] as const;

const iso = (ms: number) => new Date(Math.round(ms)).toISOString();

export function buildExport(p: { bundle: Bundle; origin: 'file' | 'fixture'; source?: string; model: Model; activityMin: number; sides: Side[]; fits: Fit[]; options: AltOption[]; readyFromMs: number }) {
  const { bundle, sides, fits } = p;
  const synthetic = bundle.provenance === 'fixture';
  const seg = (s: Side, g: Segment | null) =>
    g && { startUtc: iso(s.t0 + g.start * 60_000), endUtc: iso(s.t0 + g.end * 60_000), minutes: +(g.end - g.start).toFixed(2), truncatedStart: g.truncStart, truncatedEnd: g.truncEnd };
  return {
    tool: 'Sinavigator',
    affiliation: 'NASA Space Apps Challenge 2026 project; not affiliated with NASA.',
    aiDisclosure: AI_DISCLOSURE,
    resources: RESOURCE_SOURCES,
    exportedAt: new Date().toISOString(),
    label: synthetic ? 'SYNTHETIC DEMONSTRATION DATA — not SPICE or DEM results; not a mission recommendation' : 'Computed data as declared by the loaded file',
    dataStatus: {
      provenance: bundle.provenance,
      origin: p.origin === 'fixture' ? 'built-in synthetic fixture' : (p.source ?? 'unknown source'),
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
      evidence: {
        coordinates: 'LROC coordinates of the Apollo modules',
        mapContext: ['NASA Moon Trek', 'LROC QuickMap'],
        ephemeris: 'NASA/JPL Horizons',
        terrain: s.site.id === 'apollo17' ? 'LROC Apollo 17 terrain model' : s.site.id === 'apollo15' ? 'LROC Apollo 15 terrain model' : null,
        missionContext: 'Canadian Space Agency — Moon exploration',
      },
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
        clippedToRequestedStart: o.clippedStart,
      })),
    },
  };
}
