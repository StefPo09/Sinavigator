export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.SINAVIGATOR_BACKEND_URL ?? "http://127.0.0.1:8000";
  let upstream: Response;

  try {
    upstream = await fetch(new URL("/api/v1/bundle", backendUrl), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    return Response.json(
      { detail: `Sinavigator backend is unavailable: ${message}` },
      { status: 503, headers: { "Cache-Control": "no-store" } },
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
