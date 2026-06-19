import { NextResponse } from "next/server";
import { pingStrapiGraphql } from "@/lib/strapi-health";
import { getStrapiAuthHeaders, getStrapiGraphqlEndpoint } from "@/lib/strapi-auth";

const REQUEST_TIMEOUT_MS = 15_000;

export async function GET() {
  let headers: Record<string, string>;

  try {
    headers = getStrapiAuthHeaders();
  } catch {
    return NextResponse.json(
      { ready: false, reason: "STRAPI_API_TOKEN is not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await pingStrapiGraphql({
      endpoint: getStrapiGraphqlEndpoint(),
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    return NextResponse.json(result, { status: result.ready ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ready: false, reason: message }, { status: 503 });
  }
}
