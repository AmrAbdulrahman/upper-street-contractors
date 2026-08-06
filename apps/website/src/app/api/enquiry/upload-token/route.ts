import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ENQUIRY_MAX_FILE_BYTES } from "@/helpers/enquiry-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a short-lived Vercel Blob client-upload token so the browser can PUT a
 * hosted attachment straight to Blob, bypassing the ~4.5 MB request-body limit
 * on Functions (ADR 0014).
 *
 * This is a public, unauthenticated endpoint on a marketing site, so it is also
 * a write endpoint anyone can find. Three guards:
 *   1. Honeypot — the same hidden `company_website` field /api/enquiry checks.
 *   2. Per-IP rate limit in Redis (INCR + EXPIRE), so a script cannot park
 *      unbounded blobs in the store. There is no pruning job, so cost from an
 *      abusive burst would be permanent.
 *   3. `maximumSizeInBytes` on the token itself — Blob rejects an oversize PUT
 *      even though the client already checked, because the client check is only
 *      a courtesy.
 */

const RATE_LIMIT_WINDOW_SECONDS = 600;
const RATE_LIMIT_MAX_UPLOADS = 20;

/**
 * Direct client rather than the zero-cms adapters in lib/zero-cms/server.ts —
 * those expose an EngineAdapter, not raw Redis, and this needs a plain INCR.
 * The read-write token is required for INCR and never leaves the server.
 */
let redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.STORAGE_KV_REST_API_URL;
  const token = process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) return null;

  redis ??= new Redis({ url, token });

  return redis;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** True when this IP has exhausted its window. Fails OPEN if Redis is down —
 *  a storage blip must not take the enquiry form offline. */
async function isRateLimited(request: Request): Promise<boolean> {
  const store = getRedis();
  if (!store) return false;

  const key = `enquiry:upload-rate:${clientIp(request)}`;
  try {
    const count = await store.incr(key);
    if (count === 1) await store.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    return count > RATE_LIMIT_MAX_UPLOADS;
  } catch (e) {
    console.error("enquiry/upload-token: rate limit check failed", e);

    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (await isRateLimited(request)) {
    return NextResponse.json(
      { error: "Too many uploads from this connection. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // The wizard forwards its honeypot value here as the client payload.
        let honeypot = "";
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload) as { honeypot?: unknown };
            honeypot =
              typeof parsed.honeypot === "string" ? parsed.honeypot.trim() : "";
          } catch {
            // Unparseable payload is treated as absent, not as a bot signal.
          }
        }
        if (honeypot !== "") throw new Error("Rejected.");

        return {
          // Any file type — see the rationale in helpers/enquiry-files.ts.
          allowedContentTypes: undefined,
          maximumSizeInBytes: ENQUIRY_MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
      // No `onUploadCompleted` — the wizard sends the resulting URLs with the
      // enquiry itself, so there is nothing for us to record out of band (and
      // the callback never fires against localhost anyway).
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("enquiry/upload-token: token generation failed", e);

    return NextResponse.json(
      { error: "Could not start the upload. Please try again." },
      { status: 400 },
    );
  }
}
