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
 *                       does not touch the credit balance, so this goes
 *                       straight to the vendor with nothing in between.
 *   GET ?id=<hit id>  — the full address behind one suggestion. BILLED, one
 *                       credit, so it happens once per enquiry — and this one
 *                       is cached, because that is where the money is.
 *
 * Ideal Postcodes is perfectly happy to be called from a browser with a
 * URL-restricted key, and its own React package does exactly that. We don't,
 * for three reasons:
 *
 *   1. A browser key is a public key, and CONTEXT.md's "Read-only service
 *      token" entry rules that vocabulary out on purpose.
 *   2. ADR 0013 makes any third party the *browser* contacts a consent-gated
 *      one. Proxying means the visitor's browser only ever talks to this
 *      origin, so refusing Functional cookies doesn't cost anyone the ability
 *      to enter their address.
 *   3. Credits are real money. On our own server we can cache.
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
const DEFAULT_CACHE_TTL_DAYS = 30;
const SECONDS_PER_DAY = 86_400;
const UPSTREAM_TIMEOUT_MS = 5_000;
const SUGGEST_LIMIT = 10;

/** Vendor success code. Anything else is a failure however it is dressed up. */
const IDPC_SUCCESS = 2000;
const IDPC_NOT_FOUND = 4040;
/** The key restricts Allowed URLs. A server sends no Referer, so it can't match. */
const IDPC_URL_NOT_WHITELISTED = 4011;

type LookupResponse =
  | { suggestions: Suggestion[] }
  | { address: LookupAddress }
  | { error: "not-found" | "unavailable" | "rate-limited" };

/**
 * Direct client rather than the zero-cms adapters in lib/zero-cms/server.ts —
 * those expose an EngineAdapter, not raw Redis, and this needs INCR and a plain
 * keyed get/set with a TTL. The read-write token never leaves the server.
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
 * Cache lifetime for a resolved address, in seconds. `0` means "don't cache at
 * all" — an escape hatch for anyone chasing an address PAF has only just
 * published. The billed half is the only half that is cached at all.
 */
function addressTtlSeconds(): number {
  const raw = process.env.IDEAL_POSTCODES_CACHE_TTL_DAYS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_CACHE_TTL_DAYS * SECONDS_PER_DAY;
  }

  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) {
    console.error(
      `address-lookup: IDEAL_POSTCODES_CACHE_TTL_DAYS is not a number ("${raw}"), using ${DEFAULT_CACHE_TTL_DAYS}`,
    );

    return DEFAULT_CACHE_TTL_DAYS * SECONDS_PER_DAY;
  }

  return Math.round(days * SECONDS_PER_DAY);
}

async function readCache<T>(key: string, ttl: number): Promise<T | null> {
  const store = getRedis();
  if (!store || ttl === 0) return null;

  try {
    // @upstash/redis deserialises JSON for us.
    return await store.get<T>(key);
  } catch (e) {
    console.error("address-lookup: cache read failed", e);

    return null;
  }
}

async function writeCache<T>(key: string, value: T, ttl: number): Promise<void> {
  const store = getRedis();
  if (!store || ttl === 0) return;

  try {
    await store.set(key, value, { ex: ttl });
  } catch (e) {
    console.error("address-lookup: cache write failed", e);
  }
}

const json = (body: LookupResponse, status: number) =>
  NextResponse.json(body, {
    status,
    // What the visitor typed is the visitor's; the answer is cached in Redis.
    headers: { "Cache-Control": "no-store" },
  });

type Envelope<T> = { code?: number; message?: string; result?: T };

/** One call to the vendor. Returns null once it has logged the reason. */
async function callVendor<T>(path: string): Promise<Envelope<T> | null> {
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
      { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
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
    // generic message sends you looking in the wrong place. Allowed URLs
    // defend a key embedded in a browser; this key lives on the server and
    // sends no Referer, so a whitelist can only ever reject it. Clear the list
    // and keep the daily cap — that is the control that still applies.
    console.error(
      "address-lookup: clear Allowed URLs on this key (Ideal Postcodes -> API Keys). " +
        "A server-side key sends no Referer, so any whitelist rejects every request.",
    );
  }
}

/**
 * Step 1 — free, and deliberately uncached.
 *
 * A cache would earn its keep if queries repeated, and while typing they barely
 * do: every keystroke is a new prefix, so a Redis round-trip before the vendor
 * call is latency spent to miss. Since the vendor charges nothing here, the
 * cache was buying nothing and costing a hop on the request the visitor is
 * actually waiting on. The paid half is still cached.
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

/** Step 2 — one credit. The full address behind a chosen suggestion. */
async function resolve(request: Request, id: string): Promise<Response> {
  if (await isRateLimited(request, "resolve", RATE_LIMIT_MAX_RESOLVE)) {
    return json({ error: "rate-limited" }, 429);
  }

  const ttl = addressTtlSeconds();
  const key = `idpc:id:${id}`;
  const cached = await readCache<LookupAddress>(key, ttl);
  if (cached) {
    return json({ address: cached }, 200);
  }

  const body = await callVendor<IdealPostcodesAddress>(
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

  const address = toLookupAddress(body.result);
  await writeCache(key, address, ttl);

  return json({ address }, 200);
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id) return resolve(request, id);

  return suggest(request, params.get("q") ?? "");
}
