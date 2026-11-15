import { buildFixtureBundle } from './fixtures.ts';
import type { Bundle } from './types.ts';
import { validateBundle } from './validate.ts';

export type LoadResult =
  | { status: 'loaded'; bundle: Bundle; warnings: string[]; origin: 'file' | 'fixture'; reason?: string }
  | { status: 'invalid'; errors: string[]; warnings: string[] };

export const BUNDLE_PATH = '/api/bundle';
const STATIC_BUNDLE_PATH = '/data/bundle.json';

/**
 * Loads the bundle through the Python API, then tries the generated static bundle
 * to preserve existing deployments that have not started the backend yet.
 * A present but malformed bundle is always reported rather than silently replaced.
 */
export async function loadBundle(): Promise<LoadResult> {
  let reason = 'Backendul nu a putut fi contactat.';
  let res: Response | null = null;
  for (const path of [BUNDLE_PATH, STATIC_BUNDLE_PATH]) {
    try {
      const candidate = await fetch(path, { cache: 'no-store' });
      if (candidate.ok && (candidate.headers.get('content-type') ?? '').includes('json')) {
        res = candidate;
        break;
      }
      reason = `Fișierul de date nu este disponibil la ${path}.`;
    } catch (error) {
      reason = error instanceof Error ? error.message : 'Eroare necunoscută la citirea datelor.';
    }
  }

  if (!res) return fixture(`${reason} Nu există un bundle static utilizabil.`);
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
