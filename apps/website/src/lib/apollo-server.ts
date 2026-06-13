import { ApolloLink, HttpLink } from '@apollo/client'
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs'
import { createContentfulPreviewLink } from './apollo-preview-link'
import {
  getContentfulAccessToken,
  isContentfulPreviewEnabled,
} from '@/helpers'

function getEndpoint() {
  const spaceId = process.env.CONTENTFUL_SPACE_ID
  if (!spaceId) throw new Error('CONTENTFUL_SPACE_ID is not set')
  return `https://graphql.contentful.com/content/v1/spaces/${spaceId}`
}

export function makeServerClient() {
  const preview = isContentfulPreviewEnabled()
  const token = getContentfulAccessToken()

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([
      createContentfulPreviewLink(),
      new HttpLink({
        uri: getEndpoint(),
        headers: { Authorization: `Bearer ${token}` },
        fetchOptions: preview
          ? { cache: 'no-store' }
          : { cache: 'force-cache' },
      }),
    ]),
  })
}

export const { getClient, query, PreloadQuery } = registerApolloClient(() =>
  makeServerClient(),
)
