import { withCors } from "@/lib/zero-cms/cors";
import { getZeroCmsAdapter } from "@/lib/zero-cms/server";

// Serves media bytes from the zero-cms store. Node runtime (fs-backed).
export const runtime = "nodejs";

export const OPTIONS = withCors(async () => new Response(null, { status: 204 }));

export const GET = withCors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
  const { id } = await params;
  try {
    const adapter = await getZeroCmsAdapter();
    const { item, bytes } = await adapter.getMedia(id);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": item.mime,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
