// Find supported alternatives: known joint Sun+Earth windows long enough for the activity,
// in loaded scenarios that start at or after the requested start.
// Ranking rule (shown in the UI): earliest absolute UTC window start, then longer window.
// "Longest window" and "earliest qualifying window" are different questions; this answers the second.

import type { Scenario } from '../data/types.ts';
import type { Analysis } from './derive.ts';

export interface AltOption {
  scenario: Scenario;
  siteId: string;
  /** absolute window boundaries (epoch ms) */
  startMs: number;
  endMs: number;
  /** window start in minutes from the scenario start */
  offsetMin: number;
  lengthMin: number;
  spareMin: number;
  /** the window is still open when that scenario's analyzed period ends */
  truncatedEnd: boolean;
}

export const RANKING_RULE =
  'Criteriu: (1) activitatea încape într-o fereastră comună cunoscută Soare + Pământ; (2) dintre acestea, cel mai devreme început UTC (la egalitate, fereastra mai lungă). Se caută în toate scenariile încărcate care încep la sau după startul cerut.';

export function findOptions(scenarios: Scenario[], analyses: Map<string, Analysis>, readyFromMs: number, activityMin: number): AltOption[] {
  const out: AltOption[] = [];
  for (const sc of scenarios) {
    const t0 = Date.parse(sc.startUtc);
    if (t0 < readyFromMs) continue;
    const a = analyses.get(sc.id);
    if (!a) continue;
    for (const w of a.segs.both) {
      const len = w.end - w.start;
      if (w.state !== 'vis' || len < activityMin - 1e-6) continue;
      out.push({
        scenario: sc,
        siteId: sc.siteId,
        startMs: t0 + w.start * 60_000,
        endMs: t0 + w.end * 60_000,
        offsetMin: w.start,
        lengthMin: len,
        spareMin: len - activityMin,
        truncatedEnd: w.truncEnd,
      });
    }
  }
  out.sort((x, y) => x.startMs - y.startMs || y.lengthMin - x.lengthMin);
  // the same physical window can appear in overlapping scenarios of one site: keep the first
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.siteId}|${Math.round(o.startMs / 60_000)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
