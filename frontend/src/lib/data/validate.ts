// Structural validation of a Bundle before anything is rendered.
// This proves the file is internally consistent, NOT that its science is correct.

import type { Bundle } from './types.ts';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function validateBundle(raw: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.length < 40 && errors.push(m);
  if (!isObj(raw)) return { errors: ['The file is not a JSON object.'], warnings };
  const b = raw as Partial<Bundle> & Record<string, unknown>;

  if (b.provenance !== 'fixture' && b.provenance !== 'computed') err('`provenance` must be "fixture" or "computed".');
  if (!str(b.generatedAt) || !Number.isFinite(Date.parse(b.generatedAt))) err('`generatedAt` must be an ISO date.');
  if (!isObj(b.rules) || !finite(b.rules.sunMarginDeg) || !finite(b.rules.earthMarginDeg)) err('`rules.sunMarginDeg` and `rules.earthMarginDeg` must be numbers (degrees).');

  const siteIds = new Set<string>();
  if (!Array.isArray(b.sites) || b.sites.length === 0) err('`sites` must be a non-empty array.');
  else
    b.sites.forEach((s, i) => {
      if (!isObj(s) || !str(s.id)) return err(`sites[${i}] needs an \`id\`.`);
      if (siteIds.has(s.id)) err(`Duplicate site id "${s.id}".`);
      siteIds.add(s.id);
      if (!str(s.name) || !str(s.short)) err(`Site "${s.id}" needs \`name\` and \`short\`.`);
      if (!finite(s.latDeg) || Math.abs(s.latDeg) > 90) err(`Site "${s.id}": \`latDeg\` must be within ±90°.`);
      if (!finite(s.lonDeg)) err(`Site "${s.id}": \`lonDeg\` must be a number.`);
      if (!finite(s.observerHeightM)) err(`Site "${s.id}": \`observerHeightM\` must be a number (metres).`);
    });

  const profiled = new Set<string>();
  if (!Array.isArray(b.profiles)) err('`profiles` must be an array (it may be empty).');
  else
    b.profiles.forEach((p, i) => {
      if (!isObj(p) || !str(p.siteId)) return err(`profiles[${i}] needs a \`siteId\`.`);
      if (!siteIds.has(p.siteId)) err(`Profile ${i} refers to unknown site "${p.siteId}".`);
      if (profiled.has(p.siteId)) err(`Site "${p.siteId}" has more than one profile.`);
      profiled.add(p.siteId);
      const n = finite(p.stepDeg) && p.stepDeg > 0 ? 360 / p.stepDeg : NaN;
      if (!Number.isInteger(Math.round(n * 1e6) / 1e6)) return err(`Profile "${p.siteId}": \`stepDeg\` must divide 360.`);
      if (!Array.isArray(p.elevDeg) || p.elevDeg.length !== Math.round(n)) return err(`Profile "${p.siteId}": expected ${Math.round(n)} terrain angles, found ${Array.isArray(p.elevDeg) ? p.elevDeg.length : 'none'}.`);
      let known = 0;
      for (const v of p.elevDeg) {
        if (v === null) continue;
        if (!finite(v) || Math.abs(v) > 90) return err(`Profile "${p.siteId}": terrain angles must be numbers within ±90° or null.`);
        known++;
      }
      if (known === 0) warnings.push(`Profile "${p.siteId}" has no terrain values; terrain results for this site are unknown.`);
      else if (known < p.elevDeg.length) warnings.push(`Profile "${p.siteId}" has ${p.elevDeg.length - known} azimuth sectors without terrain data (shown as unknown).`);
    });

  const ids = new Set<string>();
  const pairs = new Set<string>();
  if (!Array.isArray(b.scenarios) || b.scenarios.length === 0) err('`scenarios` must be a non-empty array.');
  else
    b.scenarios.forEach((s, i) => {
      if (!isObj(s) || !str(s.id)) return err(`scenarios[${i}] needs an \`id\`.`);
      const tag = `Scenario "${s.id}"`;
      if (ids.has(s.id)) err(`Duplicate scenario id "${s.id}".`);
      ids.add(s.id);
      if (!str(s.siteId) || !siteIds.has(s.siteId)) err(`${tag} refers to unknown site "${String(s.siteId)}".`);
      if (!str(s.startUtc) || !Number.isFinite(Date.parse(s.startUtc))) return err(`${tag}: \`startUtc\` must be an ISO date.`);
      const pair = `${s.siteId}|${Date.parse(s.startUtc)}`;
      if (pairs.has(pair)) err(`${tag}: another scenario has the same site and start.`);
      pairs.add(pair);
      if (!finite(s.durationH) || s.durationH <= 0 || !finite(s.stepMin) || s.stepMin <= 0) return err(`${tag}: \`durationH\` and \`stepMin\` must be positive.`);
      const n = (s.durationH * 60) / s.stepMin + 1;
      if (Math.abs(n - Math.round(n)) > 1e-6) return err(`${tag}: duration is not a whole number of steps.`);
      for (const body of ['sun', 'earth'] as const) {
        const ser = s[body];
        if (!isObj(ser) || !Array.isArray(ser.azDeg) || !Array.isArray(ser.elDeg)) {
          err(`${tag}: missing ${body} series.`);
          continue;
        }
        if (ser.azDeg.length !== Math.round(n) || ser.elDeg.length !== Math.round(n)) {
          err(`${tag}: ${body} series must have ${Math.round(n)} samples (found az ${ser.azDeg.length}, el ${ser.elDeg.length}).`);
          continue;
        }
        if (!ser.azDeg.every(finite)) err(`${tag}: ${body} azimuths must all be numbers.`);
        if (!ser.elDeg.every((v) => v === null || (finite(v) && Math.abs(v) <= 90))) err(`${tag}: ${body} elevations must be numbers within ±90° or null.`);
        const unknown = ser.elDeg.filter((v) => v === null).length;
        if (unknown) warnings.push(`${tag}: ${unknown} ${body === 'sun' ? 'Sun' : 'Earth'} samples are missing (shown as unknown).`);
      }
    });

  if (Array.isArray(b.scenarios) && Array.isArray(b.profiles))
    for (const id of new Set(b.scenarios.filter(isObj).map((s) => s.siteId as string)))
      if (siteIds.has(id) && !profiled.has(id)) warnings.push(`Site "${id}" has no terrain profile; only the ideal horizon is available.`);

  return { errors, warnings };
}
