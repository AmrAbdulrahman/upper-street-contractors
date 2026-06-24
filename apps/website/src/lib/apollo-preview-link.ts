import { ApolloLink, Observable } from '@apollo/client'
import { isStrapiInspectionEnabled } from '@/components/metadata/is-strapi-inspection-enabled'

// Injects `status: DRAFT|PUBLISHED` into every server operation based on edit
// mode (inspection) for *this* request — not the global ENABLE_PREVIEW flag. So
// staging looks like prod (PUBLISHED) until the editor turns edit mode on
// (?inspect=true), and prod stays PUBLISHED + static (the resolver short-circuits
// without reading headers when ENABLE_PREVIEW!==true).
export function createPreviewLink(): ApolloLink {
  return new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        let sub: { unsubscribe(): void } | undefined
        isStrapiInspectionEnabled()
          .then((inspect) => {
            operation.variables = {
              ...operation.variables,
              status: inspect ? 'DRAFT' : 'PUBLISHED',
            }
            sub = forward(operation).subscribe(observer)
          })
          .catch((err) => observer.error(err))
        return () => sub?.unsubscribe()
      }),
  )
}
