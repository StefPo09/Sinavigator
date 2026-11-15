import { buildFixtureBundle } from './fixtures.ts';
import type { Bundle } from './types.ts';
import { validateBundle } from './validate.ts';

export type LoadResult =
  | { status: 'loaded'; bundle: Bundle; warnings: string[]; origin: 'file' | 'fixture'; source?: string; reason?: string }
  | { status: 'invalid'; errors: string[]; warnings: string[]; source: string };

export const BUNDLE_PATH = '/api/bundle';
const STATIC_BUNDLE_PATH = '/data/bundle.json';
/** Cât așteptăm o sursă înainte s-o considerăm indisponibilă (proxy-ul are propriul termen, mai scurt). */
const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(path: string): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(path, { cache: 'no-store', signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Loads the bundle through the Python API, then tries the generated static bundle
 * to preserve existing deployments that have not started the backend yet.
 * A present but malformed bundle is always reported rather than silently replaced.
 * Every request has a timeout, so the loading state always ends.
 */
export async function loadBundle(): Promise<LoadResult> {
  const reasons: string[] = [];
  let res: Response | null = null;
  let source = '';
  for (const path of [BUNDLE_PATH, STATIC_BUNDLE_PATH]) {
    try {
      const candidate = await fetchWithTimeout(path);
      if (candidate.ok && (candidate.headers.get('content-type') ?? '').includes('json')) {
        res = candidate;
        source = path;
        break;
      }
      reasons.push(`${path}: response ${candidate.status}`);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      reasons.push(`${path}: ${aborted ? `no response within ${TIMEOUT_MS / 1000} s` : error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (!res) return fixture(`No data source gave a usable answer (${reasons.join('; ')}).`);
  let raw: unknown;
  try {
    raw = await res.json();
  } catch (e) {
    return { status: 'invalid', errors: [`The data from ${source} is not valid JSON: ${(e as Error).message}`], warnings: [], source };
  }
  const report = validateBundle(raw);
  if (report.errors.length) return { status: 'invalid', ...report, source };
  return { status: 'loaded', bundle: raw as Bundle, warnings: report.warnings, origin: 'file', source };
}

export function fixture(reason: string): LoadResult {
  const bundle = buildFixtureBundle();
  return { status: 'loaded', bundle, warnings: validateBundle(bundle).warnings, origin: 'fixture', reason };
}
