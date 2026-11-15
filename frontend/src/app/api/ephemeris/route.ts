// Geocentric Moon and Sun positions from NASA/JPL Horizons for the coming weeks, for the
// Earth–Moon transfer view. Horizons sends no CORS headers, so the browser asks this route.
import { parseHorizonsObserver, type SeriesData } from "@/lib/logic/ephemerisSeries";

export const dynamic = "force-dynamic";

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";
const DAY = 86_400_000;
const STEP_MS = 3_600_000;
/** One day back (for clocks slightly behind) and 45 ahead: the transfer search spans 40 days plus the flight. */
const SPAN_BEFORE = DAY;
const SPAN_AFTER = 45 * DAY;
const TIMEOUT_MS = 20_000;
const KEEP_MS = 6 * 3_600_000;

let cached: { day: number; at: number; data: SeriesData } | null = null;

const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

async function observer(body: "301" | "10", startMs: number, stopMs: number) {
  const q = new URLSearchParams({
    format: "text",
    COMMAND: `'${body}'`,
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${stamp(startMs)}'`,
    STOP_TIME: `'${stamp(stopMs)}'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: "'20,31'",
    CSV_FORMAT: "'YES'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
  });
  const res = await fetch(`${HORIZONS}?${q}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Horizons answered ${res.status}`);
  const { times, rows } = parseHorizonsObserver(await res.text());
  if (times[0] !== startMs || times.some((t, i) => t !== startMs + i * STEP_MS)) throw new Error("Horizons: rows are not on the requested hourly grid");
  return rows;
}

export async function GET() {
  const day = Math.floor(Date.now() / DAY) * DAY;
  if (!cached || cached.day !== day || Date.now() - cached.at > KEEP_MS) {
    const startMs = day - SPAN_BEFORE;
    const stopMs = day + SPAN_AFTER;
    try {
      const [moon, sun] = await Promise.all([observer("301", startMs, stopMs), observer("10", startMs, stopMs)]);
      if (moon.length !== sun.length) throw new Error("Horizons: Moon and Sun series differ in length");
      cached = { day, at: Date.now(), data: { source: "NASA/JPL Horizons (geocentric, hourly)", startMs, stepMs: STEP_MS, moon, sun } };
    } catch (error) {
      if (!cached) {
        const message = error instanceof Error ? error.message : "unknown error";
        return Response.json({ detail: `Horizons is unavailable: ${message}` }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      // keep serving the last good series while Horizons is down
    }
  }
  return Response.json(cached!.data, { headers: { "Cache-Control": "public, max-age=3600" } });
}
