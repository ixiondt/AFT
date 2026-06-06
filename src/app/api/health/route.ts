/**
 * Liveness probe — cheap. Returns 200 if the process is up.
 * Used by container HEALTHCHECK.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
