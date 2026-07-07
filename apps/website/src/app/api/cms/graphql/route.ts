import { getZeroCmsReadAdapter, getZeroCmsAuth } from "@/lib/zero-cms/server";
import { createGraphQLHandler } from "@usc/zero-cms-graphql";

// GraphQL over the Redis-backed store -> Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let handle: ((req: Request) => Promise<Response>) | undefined;

async function getHandle() {
  if (!handle) {
    handle = createGraphQLHandler({
      adapter: await getZeroCmsReadAdapter(),
      auth: await getZeroCmsAuth(),
    });
  }
  return handle;
}

export async function POST(req: Request): Promise<Response> {
  return (await getHandle())(req);
}

export async function GET(req: Request): Promise<Response> {
  return (await getHandle())(req);
}
