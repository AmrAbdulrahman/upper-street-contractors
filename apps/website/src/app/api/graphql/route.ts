import { NextRequest, NextResponse } from 'next/server'

function getStrapiEndpoint() {
  const url = process.env.STRAPI_URL || 'http://localhost:1337'
  return `${url}/graphql`
}

export async function POST(request: NextRequest) {
  const token = process.env.STRAPI_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { errors: [{ message: 'STRAPI_API_TOKEN is not configured' }] },
      { status: 500 },
    )
  }

  const body = await request.text()

  const response = await fetch(getStrapiEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
