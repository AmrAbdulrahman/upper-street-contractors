import { HttpLink } from '@apollo/client'
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs'

function getStrapiEndpoint() {
  const url = process.env.STRAPI_URL || 'http://localhost:1337'
  return `${url}/graphql`
}

function getStrapiToken() {
  const token = process.env.STRAPI_API_TOKEN
  if (!token) throw new Error('STRAPI_API_TOKEN is not set')
  return token
}

export function makeServerClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: getStrapiEndpoint(),
      headers: { Authorization: `Bearer ${getStrapiToken()}` },
      fetchOptions: { cache: 'force-cache' },
    }),
  })
}

export const { getClient, query, PreloadQuery } = registerApolloClient(() =>
  makeServerClient(),
)
