// Which site/start pairs exist in the loaded data. Selectors are built from real pairs,
// never from an assumed sites × dates grid.

import type { Bundle, Scenario, Site } from '../data/types.ts';

export interface Sel {
  siteId: string;
  /** epoch ms of the chosen start; null = the user still has to pick a supported start */
  startMs: number | null;
}

export interface Catalog {
  sites: Site[];
  /** distinct starts across the whole bundle, ascending */
  starts: number[];
  byKey: Map<string, Scenario>;
}

const key = (siteId: string, ms: number) => `${siteId}|${ms}`;

export function catalog(b: Bundle): Catalog {
  const byKey = new Map<string, Scenario>();
  for (const s of b.scenarios) byKey.set(key(s.siteId, Date.parse(s.startUtc)), s);
  const used = new Set(b.scenarios.map((s) => s.siteId));
  return {
    sites: b.sites.filter((s) => used.has(s.id)),
    starts: [...new Set(b.scenarios.map((s) => Date.parse(s.startUtc)))].sort((x, y) => x - y),
    byKey,
  };
}

export const has = (c: Catalog, siteId: string, ms: number) => c.byKey.has(key(siteId, ms));
export const find = (c: Catalog, sel: Sel | null) => (sel && sel.startMs != null ? (c.byKey.get(key(sel.siteId, sel.startMs)) ?? null) : null);
export const startsFor = (c: Catalog, siteId: string) => c.starts.filter((ms) => has(c, siteId, ms));

/** Prefer the simultaneous Apollo comparison when present, or pick defaults for a generic bundle. */
export function defaults(c: Catalog): { a: Sel; b: Sel | null } {
  const apolloStart = startsFor(c, 'apollo17').find((ms) => has(c, 'apollo15', ms));
  if (apolloStart != null) {
    return {
      a: { siteId: 'apollo17', startMs: apolloStart },
      b: { siteId: 'apollo15', startMs: apolloStart },
    };
  }

  const site = c.sites[0].id;
  const a: Sel = { siteId: site, startMs: startsFor(c, site)[0] };
  const H = 3_600_000;
  for (const dh of [72, 24]) if (has(c, site, a.startMs! + dh * H)) return { a, b: { siteId: site, startMs: a.startMs! + dh * H } };
  const other = c.sites.find((s) => s.id !== site && has(c, s.id, a.startMs!));
  if (other) return { a, b: { siteId: other.id, startMs: a.startMs } };
  const any = [...c.byKey.values()].find((s) => !(s.siteId === site && Date.parse(s.startUtc) === a.startMs));
  return { a, b: any ? { siteId: any.siteId, startMs: Date.parse(any.startUtc) } : null };
}
