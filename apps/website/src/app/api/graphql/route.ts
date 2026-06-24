import { NextRequest, NextResponse } from 'next/server'
import { getStrapiGraphqlEndpoint } from '@/lib/strapi-auth'
import { strapiFetch } from '@/lib/auth/strapi-fetch'

export async function POST(request: NextRequest) {
  const body = await request.text()

  // strapiFetch injects the editor JWT (or read-only token) and refreshes once
  // on a 401 before replaying, so client GraphQL reads survive access expiry.
  const response = await strapiFetch(getStrapiGraphqlEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body,
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
