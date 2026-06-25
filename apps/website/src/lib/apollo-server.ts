import { ApolloLink, HttpLink } from '@apollo/client'
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs'
import { createPreviewLink } from '@/lib/apollo-preview-link'
import { createAuthLink } from '@/lib/apollo-auth-link'
import { getStrapiGraphqlEndpoint } from '@/lib/strapi-auth'

export function makeServerClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    // createPreviewLink injects `status: DRAFT|PUBLISHED` (from ENABLE_PREVIEW)
    // into every operation, so all server reads honour preview mode without
    // each call site passing the variable. Must run before the terminating
    // HttpLink.
    link: ApolloLink.from([
      createPreviewLink(),
      createAuthLink(),
      new HttpLink({
        uri: getStrapiGraphqlEndpoint(),
        fetchOptions: { cache: 'no-store' },
      }),
    ]),
  })
}

export const { getClient, query, PreloadQuery } = registerApolloClient(() =>
  makeServerClient(),
)
