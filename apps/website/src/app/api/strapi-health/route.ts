import { NextResponse } from "next/server";
import { pingStrapiGraphql } from "@/lib/strapi-health";
import { getStrapiAuthHeaders, getStrapiGraphqlEndpoint } from "@/lib/strapi-auth";

const REQUEST_TIMEOUT_MS = 15_000;

export async function GET() {
  try {
    const headers = await getStrapiAuthHeaders();
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
