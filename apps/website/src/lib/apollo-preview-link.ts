import { ApolloLink } from '@apollo/client'
import { withContentfulPreviewVariables } from '@/helpers'

export function createPreviewLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    operation.variables = withContentfulPreviewVariables(operation.variables)

    return forward(operation)
  })
}
