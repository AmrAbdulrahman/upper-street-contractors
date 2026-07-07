/**
 * Resolver map backing the generated GraphQL schema with the CMS {@link Adapter}.
 * Reads compute `populate` from the selection set (so references resolve in one
 * engine call); writes call the matching Store-equivalent adapter method.
 */

import { GraphQLScalarType, valueFromASTUntyped, type GraphQLResolveInfo } from 'graphql';
import type {
  Adapter,
  EntryValues,
  MediaItem,
  OutputEntry,
  ReadStatus,
  Schema,
  Session,
  Where,
} from '@usc/zero-cms-core';
import { ZeroCmsError, roleAtLeast } from '@usc/zero-cms-core';
import { computePopulate } from './populate';
import { plural, refUnionName, typeName } from './naming';

/** Per-request GraphQL context (set by the handler). */
export interface CmsGraphQLContext {
  session?: Session | null;
  /** When true, anonymous reads are clamped to published and mutations require editor. */
  authEnabled?: boolean;
}

function ensureWrite(ctx?: CmsGraphQLContext): void {
  if (!ctx?.authEnabled) return;
  if (!ctx.session) throw new ZeroCmsError('UNAUTHORIZED', 'Sign in required');
  if (!roleAtLeast(ctx.session.role, 'editor'))
    throw new ZeroCmsError('FORBIDDEN', 'Requires "editor" role');
}

/** Anonymous callers (auth on, no session) may only read published content. */
const anon = (ctx?: CmsGraphQLContext) => Boolean(ctx?.authEnabled) && !ctx?.session;

export interface BuildArgs {
  schema: Schema;
  adapter: Adapter;
  /**
   * Build a public URL for a media item. Default: `item.url` — the real,
   * public, CDN-backed Vercel Blob URL (ADR 0008) already stored on the
   * MediaItem itself. Override only if a host wants to proxy media through
   * its own route for some reason (caching, access control, etc).
   */
  mediaUrl?: (item: MediaItem) => string;
}

/** The GraphQL shape an `asset` field resolves to. */
interface MediaOut {
  id: string;
  url: string;
  alt: string | null;
  mime: string;
  kind: string;
  width: number | null;
  height: number | null;
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value (also used for structured `blocks` content).',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast, vars) => valueFromASTUntyped(ast, vars),
});

type AnyArgs = Record<string, unknown>;

interface ListArgs {
  filters?: AnyArgs;
  pagination?: { limit?: number; offset?: number };
  sort?: Array<{ field: string; dir?: 'asc' | 'desc' }>;
  status?: ReadStatus;
  includeUnpublished?: boolean;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Drop null/undefined so unset optional inputs don't overwrite values. */
function clean(values: AnyArgs | undefined): EntryValues {
  const out: EntryValues = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

function mapFilters(filters: AnyArgs | undefined): Where | undefined {
  if (!filters) return undefined;
  const out: Where = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v == null) continue;
    out[k === 'status' ? '__status' : k] = v as Where[string];
  }
  return out;
}

function mapSort(
  sort: Array<{ field: string; dir?: 'asc' | 'desc' }> | undefined
) {
  return sort?.map((s) => ({
    field: s.field === 'status' ? '__status' : s.field,
    dir: s.dir ?? 'asc',
  }));
}

export function buildResolvers({ schema, adapter, mediaUrl }: BuildArgs) {
  const Query: Record<string, unknown> = {};
  const Mutation: Record<string, unknown> = {};
  const typeResolvers: Record<string, unknown> = {};

  const urlOf = mediaUrl ?? ((m: MediaItem) => m.url);
  let mediaCache: { at: number; map: Map<string, MediaItem> } | null = null;
  const mediaMap = async () => {
    if (!mediaCache || Date.now() - mediaCache.at > 1000) {
      const list = await adapter.listMedia();
      mediaCache = { at: Date.now(), map: new Map(list.map((m) => [m.id, m])) };
    }
    return mediaCache.map;
  };
  const toMedia = (m: MediaItem): MediaOut => ({
    id: m.id,
    url: urlOf(m),
    alt: m.alternativeText ?? null,
    mime: m.mime,
    kind: m.kind,
    width: m.width ?? null,
    height: m.height ?? null,
  });

  for (const type of schema) {
    const cms = type.__name;
    const T = typeName(cms);

    Query[lowerFirst(T)] = (
      _p: unknown,
      args: { id: string; status?: ReadStatus },
      ctx: CmsGraphQLContext,
      info: GraphQLResolveInfo
    ) =>
      adapter.get(cms, args.id, {
        status: anon(ctx) ? 'published' : args.status,
        populate: computePopulate(info, cms, schema),
      });

    Query[plural(cms)] = async (
      _p: unknown,
      args: ListArgs,
      ctx: CmsGraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      const { data } = await adapter.query(cms, {
        where: mapFilters(args.filters),
        sort: mapSort(args.sort),
        page: { limit: args.pagination?.limit, offset: args.pagination?.offset },
        status: anon(ctx) ? 'published' : args.status,
        includeUnpublished: anon(ctx) ? false : args.includeUnpublished,
        populate: computePopulate(info, cms, schema),
      });
      return data; // flat array (Strapi-shaped)
    };

    // Actor is derived from the verified session (ADR 0009) — never trusted
    // from GraphQL args, same principle as the REST RPC handler. `ensureWrite`
    // already guarantees a session exists whenever auth is enabled; the
    // 'system' fallback only matters for an intentionally open/dev schema.
    const actorOf = (ctx?: CmsGraphQLContext) => ctx?.session?.userId ?? 'system';

    Mutation[`create${T}`] = (
      _p: unknown,
      a: { values: AnyArgs },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.create(cms, clean(a.values), actorOf(ctx));
    };
    Mutation[`update${T}`] = (
      _p: unknown,
      a: { id: string; values: AnyArgs; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.update(cms, a.id, clean(a.values), actorOf(ctx), a.expectedLastEditedAt);
    };
    Mutation[`patch${T}`] = (
      _p: unknown,
      a: { id: string; values: AnyArgs; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.patch(cms, a.id, clean(a.values), actorOf(ctx), a.expectedLastEditedAt);
    };
    Mutation[`delete${T}`] = async (
      _p: unknown,
      a: { id: string; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      await adapter.delete(cms, a.id, actorOf(ctx), a.expectedLastEditedAt);
      return true;
    };
    Mutation[`publish${T}`] = (
      _p: unknown,
      a: { id: string; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.publish(cms, a.id, actorOf(ctx), a.expectedLastEditedAt);
    };
    Mutation[`unpublish${T}`] = (
      _p: unknown,
      a: { id: string; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.unpublish(cms, a.id, actorOf(ctx), a.expectedLastEditedAt);
    };
    Mutation[`discardDraft${T}`] = (
      _p: unknown,
      a: { id: string; expectedLastEditedAt: string },
      ctx: CmsGraphQLContext
    ) => {
      ensureWrite(ctx);
      return adapter.discardDraft(cms, a.id, actorOf(ctx), a.expectedLastEditedAt);
    };

    // Object meta fields (mapped from __id/__type/__status) + asset resolution.
    const obj: Record<string, unknown> = {
      id: (s: OutputEntry) => s.__id,
      type: (s: OutputEntry) => s.__type,
      status: (s: OutputEntry) => s.__status,
      hasDraft: (s: OutputEntry) => s.hasDraft,
      lastEditedAt: (s: OutputEntry) => s.__lastEditedAt,
    };
    for (const f of type.fields) {
      if (f.__type === 'asset') {
        obj[f.__name] = async (s: OutputEntry): Promise<MediaOut | null> => {
          const id = s[f.__name];
          if (typeof id !== 'string' || !id) return null;
          const m = (await mediaMap()).get(id);
          return m ? toMedia(m) : null;
        };
      }
    }
    typeResolvers[T] = obj;

    // Union resolveType for multi-target reference fields.
    for (const f of type.fields) {
      if (
        (f.__type === 'reference' || f.__type === 'references') &&
        f.allowedTypes.length > 1
      ) {
        typeResolvers[refUnionName(cms, f.__name)] = {
          __resolveType: (obj: OutputEntry) => typeName(obj.__type),
        };
      }
    }
  }

  return { JSON: JSONScalar, Query, Mutation, ...typeResolvers };
}
