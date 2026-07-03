# 4. zero-cms core stays env-independent via a pluggable adapter

Date: 2026-06-28

## Status

Accepted

## Context

zero-cms-core needs `fs` to read/write its base directory, so it is node-only. But
zero-cms-app and zero-cms-widget are React and run in the browser, where there is no
`fs`. The generated Store cannot call `fs` directly from a component. We also want
core to stay decoupled from any specific host (Next, Strapi, a CLI, tests).

## Decision

Core talks to storage only through an **Adapter** interface (read/write schema + data,
put/get/list/delete media). The generated client is a **factory**: `createClient(adapter)`
returns the typed per-Type Stores. The adapter is injected — core never imports `fs`
directly into the client path.

Two adapters ship:

- `nodeFsAdapter` — direct file-system access (servers, CLIs, tests).
- `httpAdapter` — talks to a small reference server that wraps `nodeFsAdapter`.

Browser apps inject `httpAdapter`; node tools inject `nodeFsAdapter`.

A consequence: any operation that must cross the adapter — notably `query` — has to be
**serializable**. So query uses a filter-object DSL (`where`/`sort`/`page`), not JS
predicate functions.

## Consequences

- Core is genuinely environment-independent; the same client runs in node, SSR, or an
  SPA-over-HTTP.
- We must ship and maintain a reference server + a defined wire protocol.
- The filter DSL is constrained to serializable operators (it maps cleanly onto a
  future GraphQL `where` input — see ADR 0005).
