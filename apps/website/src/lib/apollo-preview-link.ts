import { ApolloLink } from '@apollo/client'
import { getAppEnv } from './app-env'

/**
 * Injects `status: DRAFT|PUBLISHED` into every server operation based on edit
 * mode (inspection) for *this* request — not the global ENABLE_PREVIEW flag. So
 * staging looks like prod (PUBLISHED) until the editor turns edit mode on
 * (?inspect=true), and prod stays PUBLISHED + static (the resolver short-circuits
 * without reading headers when ENABLE_PREVIEW!==true).
 * @returns ApolloLink
 */
export function createPreviewLink(): ApolloLink {
  return new ApolloLink(
    (operation, forward) => {
      const appEnv = getAppEnv();

      if (appEnv === "preview") {
        operation.variables = {
          ...operation.variables,
          status: 'DRAFT',
          includeUnpublished: true,
        }
      }
      return forward(operation);
    }
  )
}
