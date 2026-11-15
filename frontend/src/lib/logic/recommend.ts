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
  /** the window was already open at the requested start; only the part after it is counted */
  clippedStart: boolean;
}

export const RANKING_RULE =
  'Rule: (1) the activity fits in a known common Sun + Earth window, counted from the requested start; (2) among those, the earliest UTC start (on a tie, the longer window). A window already open at the requested start only counts from that start.';

export function findOptions(scenarios: Scenario[], analyses: Map<string, Analysis>, readyFromMs: number, activityMin: number): AltOption[] {
  const out: AltOption[] = [];
  for (const sc of scenarios) {
    const t0 = Date.parse(sc.startUtc);
    const a = analyses.get(sc.id);
    if (!a) continue;
    // a scenario that started earlier still counts from readyFromMs on: only the part of a
    // window after the requested start is usable
    const from = Math.max(0, (readyFromMs - t0) / 60_000);
    for (const w of a.segs.both) {
      if (w.state !== 'vis' || w.end <= from) continue;
      const start = Math.max(w.start, from);
      const len = w.end - start;
      if (len < activityMin - 1e-6) continue;
      out.push({
        scenario: sc,
        siteId: sc.siteId,
        startMs: t0 + start * 60_000,
        endMs: t0 + w.end * 60_000,
        offsetMin: start,
        lengthMin: len,
        spareMin: len - activityMin,
        truncatedEnd: w.truncEnd,
        clippedStart: start > w.start,
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
