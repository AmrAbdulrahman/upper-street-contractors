import { ApolloLink } from '@apollo/client'
import { withPreviewVariables } from '@/helpers'

export function createPreviewLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    operation.variables = withPreviewVariables(operation.variables)

    return forward(operation)
  })
}
