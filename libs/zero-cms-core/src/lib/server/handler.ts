/**
 * Reference server: a framework-agnostic Fetch handler that exposes an Adapter
 * over the RPC protocol. Mount it in a Next route handler, Bun, Deno, or node.
 *
 *   const adapter = await createNodeFsAdapter(baseDir);
 *   const handle = createRequestHandler(adapter, { auth });
 *   // Next: export const POST = (req) => handle(req);
 *
 * When `auth` is configured, the caller identity stamped on every mutation
 * (ADR 0009) is derived from the **verified session**, never trusted from the
 * client-sent args — a client claiming to be someone else would otherwise be
 * trivial. Only when `auth` is omitted entirely (dev/trusted environments, no
 * session to derive from) does the client-supplied actor get used as-is.
 */

import type { Adapter } from '../adapter/adapter';
import { RPC_PATH, type RpcRequest } from '../adapter/protocol';
import { base64ToBytes, bytesToBase64 } from '../adapter/base64';
import { ZeroCmsError } from '../model/errors';
import type { Auth } from '../engine/auth/auth';
import { authorizeRpc, getBearer } from './authorize';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ZeroCmsError) {
    const status =
      err.code === 'NOT_FOUND' || err.code === 'TYPE_NOT_FOUND'
        ? 404
        : err.code === 'VALIDATION'
          ? 400
          : err.code === 'UNAUTHORIZED'
            ? 401
            : err.code === 'FORBIDDEN'
              ? 403
              : 409;
    return json(
      { error: { code: err.code, message: err.message, details: err.details } },
      status
    );
  }
  return json(
    { error: { code: 'CONFLICT', message: (err as Error)?.message ?? 'Error' } },
    500
  );
}

async function dispatch(
  adapter: Adapter,
  op: string,
  args: unknown[],
  actorOverride: string | undefined
): Promise<unknown> {
  const actorOf = (fromArgs: unknown) => actorOverride ?? (fromArgs as string);

  switch (op) {
    case 'getSchema':
      return adapter.getSchema();
    case 'getSchemaVersion':
      return adapter.getSchemaVersion();
    case 'saveSchema':
      return adapter.saveSchema(
        args[0] as never,
        actorOf(args[1]),
        args[2] as string | null,
        args[3] as never
      );
    case 'create':
      return adapter.create(args[0] as string, args[1] as never, actorOf(args[2]));
    case 'update':
      return adapter.update(
        args[0] as string,
        args[1] as string,
        args[2] as never,
        actorOf(args[3]),
        args[4] as string
      );
    case 'patch':
      return adapter.patch(
        args[0] as string,
        args[1] as string,
        args[2] as never,
        actorOf(args[3]),
        args[4] as string
      );
    case 'delete':
      return adapter
        .delete(args[0] as string, args[1] as string, actorOf(args[2]), args[3] as string)
        .then(() => ({ ok: true }));
    case 'publish':
      return adapter.publish(
        args[0] as string,
        args[1] as string,
        actorOf(args[2]),
        args[3] as string
      );
    case 'unpublish':
      return adapter.unpublish(
        args[0] as string,
        args[1] as string,
        actorOf(args[2]),
        args[3] as string
      );
    case 'discardDraft':
      return adapter.discardDraft(
        args[0] as string,
        args[1] as string,
        actorOf(args[2]),
        args[3] as string
      );
    case 'get':
      return adapter.get(args[0] as string, args[1] as string, args[2] as never);
    case 'query':
      return adapter.query(args[0] as string, args[1] as never);
    case 'listDrafts':
      return adapter.listDrafts();
    case 'validateRefs':
      return adapter.validateRefs(args[0] as string, args[1] as string);
    case 'locate':
      return adapter.locate(args[0] as string);
    case 'listMedia':
      return adapter.listMedia();
    case 'putMedia':
      return adapter.putMedia(base64ToBytes(args[0] as string), args[1] as never, actorOf(args[2]));
    case 'updateMedia':
      return adapter.updateMedia(
        args[0] as string,
        args[1] as never,
        actorOf(args[2]),
        args[3] as string
      );
    case 'getMedia': {
      const { item, bytes } = await adapter.getMedia(args[0] as string);
      return { item, bytesBase64: bytesToBase64(bytes) };
    }
    case 'deleteMedia':
      return adapter
        .deleteMedia(args[0] as string, actorOf(args[1]), args[2] as string)
        .then(() => ({ ok: true }));
    default:
      throw new ZeroCmsError('VALIDATION', `Unknown op "${op}"`);
  }
}

export interface RequestHandlerOptions {
  path?: string;
  /**
   * When provided, every RPC call requires a valid Bearer session and is
   * role-checked ({@link authorizeRpc}); the session's `userId` becomes the
   * stamped actor on every mutation, ignoring whatever the client sent. Omit
   * to leave the RPC surface open (dev / trusted environments) — the client's
   * own claimed actor is trusted as-is in that case.
   */
  auth?: Auth;
}

export function createRequestHandler(
  adapter: Adapter,
  options: RequestHandlerOptions = {}
): (req: Request) => Promise<Response> {
  const path = options.path ?? RPC_PATH;
  return async (req: Request) => {
    if (new URL(req.url).pathname.replace(/\/$/, '') !== path)
      return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    if (req.method !== 'POST')
      return json({ error: { code: 'VALIDATION', message: 'POST only' } }, 405);
    try {
      // A malformed body is the caller's error (400), not a server fault (500).
      const body = (await req.json().catch(() => {
        throw new ZeroCmsError('VALIDATION', 'Invalid JSON body');
      })) as RpcRequest | null;
      const { op, args } = body ?? ({} as RpcRequest);
      let actorOverride: string | undefined;
      if (options.auth) {
        const session = await options.auth.verify(getBearer(req));
        authorizeRpc(op, session);
        actorOverride = session?.userId;
      }
      const result = await dispatch(adapter, op, args ?? [], actorOverride);
      return json(result ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
