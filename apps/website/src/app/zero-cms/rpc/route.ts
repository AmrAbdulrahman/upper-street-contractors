import { getZeroCmsHandler } from "@/lib/zero-cms/server";

// Redis-backed store -> Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const handle = await getZeroCmsHandler();
  return handle(req);
}
