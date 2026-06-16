import { NextRequest, NextResponse } from 'next/server'
import { getStrapiAuthHeaders, getStrapiGraphqlEndpoint } from '@/lib/strapi-auth'

export async function POST(request: NextRequest) {
  let headers: Record<string, string>;

  try {
    headers = getStrapiAuthHeaders();
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'STRAPI_API_TOKEN is not configured' }] },
      { status: 500 },
    )
  }

  const body = await request.text()

  const response = await fetch(getStrapiGraphqlEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
