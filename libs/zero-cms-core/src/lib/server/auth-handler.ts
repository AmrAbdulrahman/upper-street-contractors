/**
 * Auth Fetch handler. POST `{ op, args }`:
 *   public:   login
 *   session:  me, changePassword
 *   admin:    listUsers, createUser, updateUser, setPassword, deleteUser
 *
 *   const handle = createAuthHandler(auth);
 *   export const POST = (req: Request) => handle(req);
 */

import { ZeroCmsError } from '../model/errors';
import { roleAtLeast, type Session } from '../model/user';
import type { Auth } from '../engine/auth/auth';
import { getBearer } from './authorize';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ZeroCmsError) {
    const status =
      err.code === 'NOT_FOUND'
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

export type AuthOp =
  | 'login'
  | 'me'
  | 'changePassword'
  | 'listUsers'
  | 'createUser'
  | 'updateUser'
  | 'setPassword'
  | 'deleteUser';

export function createAuthHandler(
  auth: Auth
): (req: Request) => Promise<Response> {
  const session = (req: Request): Session => {
    const s = auth.verify(getBearer(req));
    if (!s) throw new ZeroCmsError('UNAUTHORIZED', 'Sign in required');
    return s;
  };
  const admin = (req: Request): Session => {
    const s = session(req);
    if (!roleAtLeast(s.role, 'admin'))
      throw new ZeroCmsError('FORBIDDEN', 'Requires "admin" role');
    return s;
  };

  async function dispatch(op: AuthOp, args: unknown[], req: Request): Promise<unknown> {
    switch (op) {
      case 'login':
        return auth.login(args[0] as string, args[1] as string);
      case 'me':
        session(req);
        return auth.me(getBearer(req));
      case 'changePassword':
        session(req);
        return auth.changeOwnPassword(
          getBearer(req) as string,
          args[0] as string,
          args[1] as string
        );
      case 'listUsers':
        admin(req);
        return auth.list();
      case 'createUser':
        admin(req);
        return auth.createUser(args[0] as never);
      case 'updateUser':
        admin(req);
        return auth.updateUser(args[0] as string, args[1] as never);
      case 'setPassword':
        admin(req);
        return auth.setPassword(args[0] as string, args[1] as string);
      case 'deleteUser':
        admin(req);
        return auth.deleteUser(args[0] as string).then(() => ({ ok: true }));
      default:
        throw new ZeroCmsError('VALIDATION', `Unknown auth op "${op}"`);
    }
  }

  return async (req: Request) => {
    if (req.method !== 'POST')
      return json({ error: { code: 'VALIDATION', message: 'POST only' } }, 405);
    try {
      const { op, args } = (await req.json()) as { op: AuthOp; args?: unknown[] };
      return json((await dispatch(op, args ?? [], req)) ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
