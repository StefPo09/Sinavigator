// Timpul global al aplicației (UTC, epoch ms) și legătura lui cu scenariile din date.

import type { Bundle, Scenario } from '../data/types.ts';

export interface Coverage {
  startMs: number;
  endMs: number;
}

/** Intervalul acoperit de date: de la primul start până la sfârșitul ultimului scenariu. */
export function coverage(b: Bundle): Coverage {
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const s of b.scenarios) {
    const t0 = Date.parse(s.startUtc);
    startMs = Math.min(startMs, t0);
    endMs = Math.max(endMs, t0 + s.durationH * 3_600_000);
  }
  return { startMs, endMs };
}

export const inScenario = (s: Scenario, ms: number) => {
  const t0 = Date.parse(s.startUtc);
  return ms >= t0 && ms <= t0 + s.durationH * 3_600_000;
};

/** Scenariile unei zone care acoperă momentul dat, în ordinea startului. */
export function scenariosCovering(b: Bundle, siteId: string, ms: number): Scenario[] {
  return b.scenarios.filter((s) => s.siteId === siteId && inScenario(s, ms)).sort((x, y) => Date.parse(x.startUtc) - Date.parse(y.startUtc));
}

export const clampTo = (c: Coverage, ms: number) => Math.min(c.endMs, Math.max(c.startMs, ms));

/** Viteze de redare: ore simulate pe secundă reală. */
export const SPEEDS = [1, 6, 24] as const;
export type Speed = (typeof SPEEDS)[number];
