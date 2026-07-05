import { withCors } from "@/lib/zero-cms/cors";
import { getZeroCmsAdapter, getZeroCmsAuth } from "@/lib/zero-cms/server";
import { createGraphQLHandler } from "@usc/zero-cms-graphql";

// GraphQL over the fs-backed store -> Node runtime, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let handle: ((req: Request) => Promise<Response>) | undefined;

async function getHandle() {
  if (!handle) {
    handle = createGraphQLHandler({
      adapter: await getZeroCmsAdapter(),
      auth: await getZeroCmsAuth(),
    });
  }
  return handle;
}

export const OPTIONS = withCors(async () => new Response(null, { status: 204 }));

export const POST = withCors(async (req: Request): Promise<Response> => {
  return (await getHandle())(req);
});

export const GET = withCors(async (req: Request): Promise<Response> => {
  return (await getHandle())(req);
});
