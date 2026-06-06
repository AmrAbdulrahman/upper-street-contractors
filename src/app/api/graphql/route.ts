import { NextRequest, NextResponse } from 'next/server'
import {
  getContentfulAccessToken,
  isContentfulPreviewEnabled,
  withContentfulPreviewVariables,
} from '@/lib/contentful-preview'

function getEndpoint() {
  const spaceId = process.env.CONTENTFUL_SPACE_ID
  if (!spaceId) throw new Error('CONTENTFUL_SPACE_ID is not set')
  return `https://graphql.contentful.com/content/v1/spaces/${spaceId}`
}

export async function POST(request: NextRequest) {
  let token: string

  try {
    token = getContentfulAccessToken()
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'Contentful token is not configured' }] },
      { status: 500 },
    )
  }

  const preview = isContentfulPreviewEnabled()
  const body = JSON.parse(await request.text()) as {
    query: string
    variables?: Record<string, unknown>
    operationName?: string
  }

  const response = await fetch(getEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...body,
      variables: withContentfulPreviewVariables(body.variables),
    }),
    cache: preview ? 'no-store' : 'force-cache',
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
