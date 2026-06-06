import { ApolloLink } from '@apollo/client'
import { withContentfulPreviewVariables } from './contentful-preview'

export function createContentfulPreviewLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    operation.variables = withContentfulPreviewVariables(operation.variables)

    return forward(operation)
  })
}
