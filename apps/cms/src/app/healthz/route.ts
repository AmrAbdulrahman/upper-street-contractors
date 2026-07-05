// Trivial liveness probe for Railway's health check — deliberately does not touch
// the adapter/store, so it stays fast and doesn't false-negative on a slow git-sync.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return new Response("ok", { status: 200 });
}
