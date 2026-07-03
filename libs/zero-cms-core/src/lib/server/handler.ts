/**
 * Reference server: a framework-agnostic Fetch handler that exposes an Adapter
 * over the RPC protocol. Mount it in a Next route handler, Bun, Deno, or node.
 *
 *   const adapter = await createNodeFsAdapter(baseDir);
 *   const handle = createRequestHandler(adapter);
 *   // Next: export const POST = (req) => handle(req);
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

async function dispatch(adapter: Adapter, op: string, args: unknown[]): Promise<unknown> {
  switch (op) {
    case 'getSchema':
      return adapter.getSchema();
    case 'saveSchema':
      return adapter.saveSchema(args[0] as never);
    case 'create':
      return adapter.create(args[0] as string, args[1] as never);
    case 'update':
      return adapter.update(args[0] as string, args[1] as string, args[2] as never);
    case 'patch':
      return adapter.patch(args[0] as string, args[1] as string, args[2] as never);
    case 'delete':
      return adapter.delete(args[0] as string, args[1] as string).then(() => ({ ok: true }));
    case 'publish':
      return adapter.publish(args[0] as string, args[1] as string);
    case 'unpublish':
      return adapter.unpublish(args[0] as string, args[1] as string);
    case 'discardDraft':
      return adapter.discardDraft(args[0] as string, args[1] as string);
    case 'get':
      return adapter.get(args[0] as string, args[1] as string, args[2] as never);
    case 'query':
      return adapter.query(args[0] as string, args[1] as never);
    case 'validateRefs':
      return adapter.validateRefs(args[0] as string, args[1] as string);
    case 'locate':
      return adapter.locate(args[0] as string);
    case 'listMedia':
      return adapter.listMedia();
    case 'putMedia':
      return adapter.putMedia(base64ToBytes(args[0] as string), args[1] as never);
    case 'getMedia': {
      const { item, bytes } = await adapter.getMedia(args[0] as string);
      return { item, bytesBase64: bytesToBase64(bytes) };
    }
    case 'deleteMedia':
      return adapter.deleteMedia(args[0] as string).then(() => ({ ok: true }));
    default:
      throw new ZeroCmsError('VALIDATION', `Unknown op "${op}"`);
  }
}

export interface RequestHandlerOptions {
  path?: string;
  /**
   * When provided, every RPC call requires a valid Bearer session and is
   * role-checked ({@link authorizeRpc}). Omit to leave the RPC surface open
   * (dev / trusted environments).
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
      const { op, args } = (await req.json()) as RpcRequest;
      if (options.auth) authorizeRpc(op, options.auth.verify(getBearer(req)));
      const result = await dispatch(adapter, op, args ?? []);
      return json(result ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
