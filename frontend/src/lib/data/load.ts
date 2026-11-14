import { buildFixtureBundle } from './fixtures.ts';
import type { Bundle } from './types.ts';
import { validateBundle } from './validate.ts';

export type LoadResult =
  | { status: 'loaded'; bundle: Bundle; warnings: string[]; origin: 'file' | 'fixture'; reason?: string }
  | { status: 'invalid'; errors: string[]; warnings: string[] };

export const BUNDLE_PATH = '/data/bundle.json';

/**
 * Loads public/data/bundle.json (written by the Python generator).
 * - missing file → labeled synthetic fixture
 * - present but unreadable or inconsistent → visible error, never a silent fallback
 */
export async function loadBundle(): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch(BUNDLE_PATH, { cache: 'no-store' });
  } catch {
    return fixture('Fișierul de date nu a putut fi citit (offline sau deschis de pe disc).');
  }
  // dev servers answer unknown paths with index.html, so a non-JSON reply also means "missing"
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return fixture('Nu există fișier de date calculate (public/data/bundle.json).');
  let raw: unknown;
  try {
    raw = await res.json();
  } catch (e) {
    return { status: 'invalid', errors: [`Fișierul de date nu este JSON valid: ${(e as Error).message}`], warnings: [] };
  }
  const report = validateBundle(raw);
  if (report.errors.length) return { status: 'invalid', ...report };
  return { status: 'loaded', bundle: raw as Bundle, warnings: report.warnings, origin: 'file' };
}

export function fixture(reason: string): LoadResult {
  const bundle = buildFixtureBundle();
  return { status: 'loaded', bundle, warnings: validateBundle(bundle).warnings, origin: 'fixture', reason };
}
