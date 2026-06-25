import { NextResponse } from 'next/server';
import { getCmsCalls } from '@/lib/dev/cms-call-collector';

/** Read fresh every request — never cached. */
export const dynamic = 'force-dynamic';

/**
 * Dev-only endpoint the CMS Call Meter polls. Returns calls recorded since the
 * given cursor. 404s on any deployed env so it cannot leak. Does not touch
 * Strapi, so polling never inflates the counts it reports.
 */
export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 });
  }

  const since = Number(new URL(req.url).searchParams.get('since')) || 0;
  return NextResponse.json(getCmsCalls(since));
}
