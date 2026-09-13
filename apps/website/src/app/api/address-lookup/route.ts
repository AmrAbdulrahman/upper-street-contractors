import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  MIN_QUERY_LENGTH,
  normalizeQuery,
  toLookupAddress,
  toSuggestions,
  type IdealPostcodesAddress,
  type IdealPostcodesHit,
  type LookupAddress,
  type Suggestion,
} from "@/helpers/address-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Enquiry Wizard's Address lookup, proxied (ADR 0026).
 *
 * Two steps, because that is how the vendor prices it:
 *
 *   GET ?q=<partial>  — suggestions as the visitor types. FREE; autocomplete
 *                       does not touch the credit balance.
 *   GET ?id=<hit id>  — the full address behind one suggestion. BILLED, one
 *                       credit, so it happens once per enquiry.
 *
 * Neither half is cached: every lookup is a live PAF read, and no visitor's
 * address is kept here once the response has gone out.
 *
 * Ideal Postcodes is perfectly happy to be called from a browser with a
 * URL-restricted key, and its own React package does exactly that. We don't,
 * for two reasons:
 *
 *   1. A browser key is a public key, and CONTEXT.md's "Read-only service
 *      token" entry rules that vocabulary out on purpose.
 *   2. ADR 0013 makes any third party the *browser* contacts a consent-gated
 *      one. Proxying means the visitor's browser only ever talks to this
 *      origin, so refusing Functional cookies doesn't cost anyone the ability
 *      to enter their address.
 *
 * What proxying costs is the one signal the vendor polices a browser key with —
 * the request's own `Referer` — so the visitor's headers ride along on the call.
 * `HEADERS_NOT_FORWARDED` is the list of what does not.
 *
 * Like /api/enquiry/upload-token this is a public, unauthenticated endpoint on
 * a marketing site, so it carries the ADR 0014 guard set: a per-IP Redis rate
 * limit that fails open, and a length check before any call at all.
 */

const RATE_LIMIT_WINDOW_SECONDS = 600;
/** Typing is free at the vendor, so this only has to stop a scraper. */
const RATE_LIMIT_MAX_SUGGEST = 300;
/** Resolving costs a credit, so it gets the tighter budget. */
const RATE_LIMIT_MAX_RESOLVE = 40;
const UPSTREAM_TIMEOUT_MS = 5_000;
const SUGGEST_LIMIT = 10;

/** Vendor success code. Anything else is a failure however it is dressed up. */
const IDPC_SUCCESS = 2000;
const IDPC_NOT_FOUND = 4040;
/** The key restricts Allowed URLs, and the request's Referer matched none. */
const IDPC_URL_NOT_WHITELISTED = 4011;

type LookupResponse =
  | { suggestions: Suggestion[] }
  | { address: LookupAddress }
  | { error: "not-found" | "unavailable" | "rate-limited" };

/**
 * Direct client rather than the zero-cms adapters in lib/zero-cms/server.ts —
 * those expose an EngineAdapter, not raw Redis, and the rate limit needs INCR
 * and EXPIRE. The read-write token never leaves the server.
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
 *  a storage blip must not stop anyone finishing the enquiry form. */
async function isRateLimited(
  request: Request,
  bucket: "suggest" | "resolve",
  max: number,
): Promise<boolean> {
  const store = getRedis();
  if (!store) return false;

  const key = `address-lookup:${bucket}:${clientIp(request)}`;
  try {
    const count = await store.incr(key);
    if (count === 1) await store.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    return count > max;
  } catch (e) {
    console.error("address-lookup: rate limit check failed", e);

    return false;
  }
}

/**
 * Headers the browser sent us that are *not* passed on to the vendor,
 * lowercased. Four groups, each a refusal rather than an oversight:
 *
 *   - Credentials — `cookie`, `authorization`. They were sent to this origin by
 *     someone told the browser talks to nobody else. Not ours to hand on.
 *   - The hop that just ended — `host`, `connection`, `content-length` and
 *     friends describe a connection that is already closed. Copied onto a fresh
 *     GET with no body they are simply untrue.
 *   - Conditional and ranged reads — `if-none-match`, `range` and the rest turn
 *     a 200 carrying JSON into a 304 or a 206 that carries none, and
 *     `upstream.json()` throws on those.
 *   - `accept-encoding`, because undici only decompresses a response when it
 *     set that header itself. Forward the browser's and the JSON arrives as
 *     gzip bytes.
 */
const HEADERS_NOT_FORWARDED = new Set([
  "accept-encoding",
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "keep-alive",
  "proxy-authorization",
  "range",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * The visitor's own request headers, minus the set above, for the upstream call.
 *
 * `Referer` is the one that earns this. Ideal Postcodes matches a key's Allowed
 * URLs against it, and a server calling on its own behalf sends none — which is
 * the whole of the 4011 story in `logRefusal`. Passing the browser's through
 * puts the real page back on the request, so a whitelist can be used again.
 *
 * It also means the vendor sees the visitor's `User-Agent`, `Accept-Language`
 * and — behind Vercel — their forwarded IP. That is a processor detail to
 * record (ADR 0026), not a consent one: the browser still contacts nobody but
 * this origin.
 */
function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (HEADERS_NOT_FORWARDED.has(name.toLowerCase())) return;

    headers.set(name, value);
  });

  return headers;
}

const json = (body: LookupResponse, status: number) =>
  NextResponse.json(body, {
    status,
    // What the visitor typed is the visitor's, and nothing here keeps a copy.
    headers: { "Cache-Control": "no-store" },
  });

type Envelope<T> = { code?: number; message?: string; result?: T };

/** One call to the vendor, under the visitor's own headers. Returns null once
 *  it has logged the reason. */
async function callVendor<T>(
  request: Request,
  path: string,
): Promise<Envelope<T> | null> {
  const apiKey = process.env.IDEAL_POSTCODES_API_KEY;
  if (!apiKey) {
    // Not fatal by design: the address fields are always visible and typable,
    // so an unconfigured key costs autofill, not the enquiry.
    console.error("address-lookup: IDEAL_POSTCODES_API_KEY is not set");

    return null;
  }

  const sep = path.includes("?") ? "&" : "?";
  try {
    const upstream = await fetch(
      `https://api.ideal-postcodes.co.uk/v1${path}${sep}api_key=${encodeURIComponent(apiKey)}`,
      {
        headers: forwardedHeaders(request),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );

    return (await upstream.json()) as Envelope<T>;
  } catch (e) {
    console.error("address-lookup: upstream request failed", e);

    return null;
  }
}

/** Logs why the vendor said no. Never returns its words to the browser: 4010
 *  and 4021 name our account state, which a public endpoint must not hand out. */
function logRefusal(body: Envelope<unknown>): void {
  console.error(
    `address-lookup: upstream refused (code ${body.code}): ${body.message}`,
  );
  if (body.code === IDPC_URL_NOT_WHITELISTED) {
    // Worth naming, because the fix is in the vendor's dashboard and the
    // generic message sends you looking in the wrong place. The call carries
    // the visitor's own Referer now, so a whitelist *can* match — but it has to
    // list the site this runs on, and it still rejects anything arriving with
    // no Referer at all (a curl, a browser configured to send none).
    console.error(
      "address-lookup: this key's Allowed URLs (Ideal Postcodes -> API Keys) did not match the " +
        "request's Referer. Add this site's origin, or clear the list and keep the daily cap.",
    );
  }
}

/**
 * Step 1 — free, and uncached.
 *
 * A cache would earn its keep if queries repeated, and while typing they barely
 * do: every keystroke is a new prefix, so a Redis round-trip before the vendor
 * call is latency spent to miss. Since the vendor charges nothing here, the
 * cache was buying nothing and costing a hop on the request the visitor is
 * actually waiting on.
 */
async function suggest(request: Request, rawQuery: string): Promise<Response> {
  const query = normalizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) {
    return json({ suggestions: [] }, 200);
  }

  if (await isRateLimited(request, "suggest", RATE_LIMIT_MAX_SUGGEST)) {
    return json({ error: "rate-limited" }, 429);
  }

  const body = await callVendor<{ hits?: IdealPostcodesHit[] }>(
    request,
    `/autocomplete/addresses?query=${encodeURIComponent(query)}&limit=${SUGGEST_LIMIT}`,
  );
  if (!body) {
    return json({ error: "unavailable" }, 502);
  }
  if (body.code !== IDPC_SUCCESS) {
    logRefusal(body);

    return json({ error: "unavailable" }, 502);
  }

  return json({ suggestions: toSuggestions(body.result?.hits ?? []) }, 200);
}

/**
 * Step 2 — one credit. The full address behind a chosen suggestion.
 *
 * Read live from the vendor every time. The address a visitor picks is theirs,
 * not ours to hold in Redis against the next person who picks the same one, so
 * every enquiry spends its credit and every answer is current PAF.
 */
async function resolve(request: Request, id: string): Promise<Response> {
  if (await isRateLimited(request, "resolve", RATE_LIMIT_MAX_RESOLVE)) {
    return json({ error: "rate-limited" }, 429);
  }

  const body = await callVendor<IdealPostcodesAddress>(
    request,
    `/autocomplete/addresses/${encodeURIComponent(id)}/gbr`,
  );
  if (!body) {
    return json({ error: "unavailable" }, 502);
  }
  if (body.code === IDPC_NOT_FOUND) {
    return json({ error: "not-found" }, 404);
  }
  if (body.code !== IDPC_SUCCESS || !body.result) {
    logRefusal(body);

    return json({ error: "unavailable" }, 502);
  }

  return json({ address: toLookupAddress(body.result) }, 200);
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id) return resolve(request, id);

  return suggest(request, params.get("q") ?? "");
}
