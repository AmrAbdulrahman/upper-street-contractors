# 5. zero-cms generates a typed client; GraphQL is a later, separate layer

Date: 2026-06-28

## Status

Accepted

## Context

The Schema (`types.json`) is the single source of truth for content shape. Consumers
want full static typing of Entries and Stores. We also want the option to add a GraphQL
API later without rewriting core.

## Decision

zero-cms-core **generates a typed client** from `types.json` (string-template codegen,
emitting `*.gen.ts` to `<dirbase>/.zero-cms/generated`, regenerated on change via a
watcher). Output: per-Type interfaces (plus `*Populated` variants), the
`createClient(adapter)` factory, and a runtime `schema` object.

Reference fields return **ids by default**, with one `populate` argument supporting
ids / shallow / arbitrarily-deep paths, backed by a **batching reference resolver
(DataLoader-style) + cycle guard**.

Core stays **GraphQL-agnostic**. A future `zero-cms-graphql` library will generate SDL
+ resolvers from the same `types.json` and sit on top of the Stores — the filter DSL
becomes `where` inputs, the populate/batching resolver serves selection sets, and the
7 Store methods map onto Query/Mutation.

## Consequences

- Consumers get real static types; `store.query()` is fully typed.
- A build/codegen step and an in-tree generated artifact per base directory.
- The batching resolver is designed up front so the later GraphQL layer needs no core
  changes — it is purely additive.
