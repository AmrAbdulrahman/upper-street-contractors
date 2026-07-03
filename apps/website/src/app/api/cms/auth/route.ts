import { getZeroCmsAuthHandler } from "@/lib/zero-cms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const handle = await getZeroCmsAuthHandler();
  if (!handle)
    return new Response(
      JSON.stringify({ error: { code: "CONFLICT", message: "Auth is not configured" } }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  return handle(req);
}
