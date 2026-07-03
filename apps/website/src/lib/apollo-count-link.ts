import { ApolloLink } from '@apollo/client'
import { incrementGraphqlRequestCount } from '@/lib/strapi-request-counters'

export function createCountLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    incrementGraphqlRequestCount()
    return forward(operation)
  })
}
