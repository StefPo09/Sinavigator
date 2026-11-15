export const dynamic = "force-dynamic";

/** Termenul proxy-ului: mai scurt decât cel din client, ca acesta să poată încerca fișierul static. */
const UPSTREAM_TIMEOUT_MS = 6_000;

export async function GET() {
  const backendUrl = process.env.SINAVIGATOR_BACKEND_URL ?? "http://127.0.0.1:8000";
  let upstream: Response;

  try {
    upstream = await fetch(new URL("/api/v1/bundle", backendUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    const message = timedOut
      ? `no response within ${UPSTREAM_TIMEOUT_MS / 1000} s`
      : error instanceof Error
        ? error.message
        : "Unknown connection error";
    return Response.json(
      { detail: `Sinavigator backend is unavailable: ${message}` },
      { status: timedOut ? 504 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
