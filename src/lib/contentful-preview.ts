export function isContentfulPreviewEnabled(): boolean {
  return process.env.CONTENTFUL_PREVIEW === 'true'
}

export function getContentfulAccessToken(): string {
  const preview = isContentfulPreviewEnabled()
  const token = preview
    ? process.env.CONTENTFUL_PREVIEW_TOKEN
    : process.env.CONTENTFUL_ACCESS_TOKEN

  if (!token) {
    throw new Error(
      preview
        ? 'CONTENTFUL_PREVIEW_TOKEN is not set'
        : 'CONTENTFUL_ACCESS_TOKEN is not set',
    )
  }

  return token
}

export function withContentfulPreviewVariables(
  variables: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...variables,
    preview: isContentfulPreviewEnabled(),
  }
}
