import { ApolloLink, Observable } from '@apollo/client'
import { getStrapiAuthHeaders } from '@/lib/strapi-auth'

// Injects the Authorization header per-operation (read at request time) rather
// than once at client construction, so a server read uses the logged-in Editor's
// JWT when present and the read-only service token otherwise. Mirrors the async
// Observable pattern in createPreviewLink. Must run before the terminating
// HttpLink so the resolved headers land in the operation context.
export function createAuthLink(): ApolloLink {
  return new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        let sub: { unsubscribe(): void } | undefined
        getStrapiAuthHeaders()
          .then((headers) => {
            operation.setContext((prev: Record<string, unknown>) => ({
              ...prev,
              headers: { ...(prev.headers as object), ...headers },
            }))
            sub = forward(operation).subscribe(observer)
          })
          .catch((err) => observer.error(err))
        return () => sub?.unsubscribe()
      }),
  )
}
