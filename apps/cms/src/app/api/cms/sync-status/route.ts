import { withCors } from "@/lib/zero-cms/cors";
import { syncStatus } from "@/lib/zero-cms/git-sync";

/**
 * Lets the admin UI (or an ops check) tell whether the last publish actually
 * reached `main` yet. git-sync is debounced + async — a successful `publish` RPC
 * response only means the write landed on disk, not that it's pushed. Poll this
 * after publishing if you need to know when it's safe to expect a production
 * rebuild to pick it up.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = withCors(async () => new Response(null, { status: 204 }));

export const GET = withCors(async (): Promise<Response> => {
  return Response.json(syncStatus());
});
