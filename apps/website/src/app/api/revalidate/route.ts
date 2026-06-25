import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  const headerSecret = req.headers.get('x-revalidate-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');

  if (!secret || (headerSecret !== secret && querySecret !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateTag('strapi', 'max');
  return NextResponse.json({ revalidated: true });
}
