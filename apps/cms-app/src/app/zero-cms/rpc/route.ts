import { withCors } from "@/lib/zero-cms/cors";
import { getZeroCmsHandler } from "@/lib/zero-cms/server";

// fs-backed store -> Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = withCors(async () => new Response(null, { status: 204 }));

export const POST = withCors(async (req: Request): Promise<Response> => {
  const handle = await getZeroCmsHandler();
  return handle(req);
});
