import { HttpLink } from '@apollo/client'
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs'
import {
  getStrapiAuthHeaders,
  getStrapiGraphqlEndpoint,
} from '@/lib/strapi-auth'

export function makeServerClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: getStrapiGraphqlEndpoint(),
      headers: getStrapiAuthHeaders(),
      fetchOptions: {
        cache:
          process.env.ENABLE_PREVIEW === 'true' ? 'no-store' : 'force-cache',
      },
    }),
  })
}

export const { getClient, query, PreloadQuery } = registerApolloClient(() =>
  makeServerClient(),
)
