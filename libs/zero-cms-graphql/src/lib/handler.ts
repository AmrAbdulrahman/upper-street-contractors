/**
 * Framework-agnostic GraphQL Fetch handler. POST executes operations against the
 * generated schema (rebuilt when the CMS Schema changes); GET serves a minimal
 * GraphiQL IDE for exploration. Mount it in any Fetch-compatible runtime.
 *
 *   const handle = createGraphQLHandler({ adapter });
 *   export const POST = (req: Request) => handle(req);
 *   export const GET  = (req: Request) => handle(req);
 */

import { graphql, type GraphQLSchema } from 'graphql';
import type { Adapter, MediaItem, Session } from '@usc/zero-cms-core';
import { buildCmsSchema } from './schema';

/** Structural — the core `Auth` instance satisfies this. */
export interface SessionVerifier {
  verify(token: string | null): Session | null;
}

export interface GraphQLHandlerOptions {
  adapter: Adapter;
  /** Serve GraphiQL on GET. Default true. */
  graphiql?: boolean;
  /** Build a public URL for a media item. Default `/api/cms/media/<id>`. */
  mediaUrl?: (item: MediaItem) => string;
  /**
   * When provided, mutations require an `editor`+ session and anonymous reads are
   * clamped to published content. Omit to leave the API open.
   */
  auth?: SessionVerifier;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  const m = h && /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const GRAPHIQL_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>zero-cms GraphQL</title>
<meta name="robots" content="noindex" />
<link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
<style>html,body,#app{height:100%;margin:0}</style></head>
<body><div id="app">Loading GraphiQL…</div>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
<script>
  const fetcher = GraphiQL.createFetcher({ url: location.pathname });
  ReactDOM.createRoot(document.getElementById('app'))
    .render(React.createElement(GraphiQL, { fetcher }));
</script></body></html>`;

export function createGraphQLHandler(
  opts: GraphQLHandlerOptions
): (req: Request) => Promise<Response> {
  let cache: { hash: string; schema: GraphQLSchema } | null = null;

  async function getSchema(): Promise<GraphQLSchema> {
    const types = await opts.adapter.getSchema();
    const hash = JSON.stringify(types);
    if (!cache || cache.hash !== hash) {
      cache = {
        hash,
        schema: buildCmsSchema({
          schema: types,
          adapter: opts.adapter,
          mediaUrl: opts.mediaUrl,
        }),
      };
    }
    return cache.schema;
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'GET') {
      if (opts.graphiql === false)
        return json({ error: 'GraphiQL disabled; POST a query' }, 405);
      return new Response(GRAPHIQL_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    let body: { query?: string; variables?: Record<string, unknown>; operationName?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ errors: [{ message: 'Invalid JSON body' }] }, 400);
    }
    if (!body.query) return json({ errors: [{ message: 'Missing query' }] }, 400);

    const result = await graphql({
      schema: await getSchema(),
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
      contextValue: {
        authEnabled: Boolean(opts.auth),
        session: opts.auth ? opts.auth.verify(bearer(req)) : null,
      },
    });
    return json(result);
  };
}
