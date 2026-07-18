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
  const session = async (req: Request): Promise<Session> => {
    const s = await auth.verify(getBearer(req));
    if (!s) throw new ZeroCmsError('UNAUTHORIZED', 'Sign in required');
    return s;
  };
  const admin = async (req: Request): Promise<Session> => {
    const s = await session(req);
    // Mirrors authorizeRpc: a forced-change-pending session may only rotate its
    // password (`session` ops stay open for exactly that), never administrate.
    if (s.forcePasswordUpdate)
      throw new ZeroCmsError('FORBIDDEN', 'Change your password before continuing');
    if (!roleAtLeast(s.role, 'admin'))
      throw new ZeroCmsError('FORBIDDEN', 'Requires "admin" role');
    return s;
  };

  async function dispatch(op: AuthOp, args: unknown[], req: Request): Promise<unknown> {
    switch (op) {
      case 'login': {
        const [email, password] = args;
        // Reject before auth.login: an undefined email would TypeError on
        // `.trim()` inside the storage ports and surface as a 500.
        if (
          typeof email !== 'string' ||
          !email.trim() ||
          typeof password !== 'string' ||
          !password
        )
          throw new ZeroCmsError('VALIDATION', 'Email and password are required');
        return auth.login(email, password);
      }
      case 'me':
        await session(req);
        return auth.me(getBearer(req));
      case 'changePassword':
        await session(req);
        return auth.changeOwnPassword(
          getBearer(req) as string,
          args[0] as string,
          args[1] as string
        );
      case 'listUsers':
        await admin(req);
        return auth.list();
      case 'createUser': {
        const s = await admin(req);
        return auth.createUser(args[0] as never, s.userId);
      }
      case 'updateUser': {
        const s = await admin(req);
        const patch = (args[1] ?? {}) as { role?: unknown; disabled?: unknown };
        // Lock-out guard: an admin can rename/re-email themselves, but never
        // strip their own access (demote/disable) — someone else must do it.
        if (
          args[0] === s.userId &&
          (patch.role !== undefined || patch.disabled !== undefined)
        )
          throw new ZeroCmsError(
            'FORBIDDEN',
            'You cannot change your own role or disable your own account'
          );
        return auth.updateUser(args[0] as string, args[1] as never, s.userId, args[2] as string);
      }
      case 'setPassword': {
        const s = await admin(req);
        return auth.setPassword(
          args[0] as string,
          args[1] as string,
          s.userId,
          args[2] as string,
          (args[3] as boolean | undefined) ?? false
        );
      }
      case 'deleteUser': {
        const s = await admin(req);
        if (args[0] === s.userId)
          throw new ZeroCmsError('FORBIDDEN', 'You cannot delete your own account');
        return auth.deleteUser(args[0] as string, args[1] as string).then(() => ({ ok: true }));
      }
      default:
        throw new ZeroCmsError('VALIDATION', `Unknown auth op "${op}"`);
    }
  }

  return async (req: Request) => {
    if (req.method !== 'POST')
      return json({ error: { code: 'VALIDATION', message: 'POST only' } }, 405);
    try {
      // A malformed body is the caller's error (400), not a server fault (500).
      const body = (await req.json().catch(() => {
        throw new ZeroCmsError('VALIDATION', 'Invalid JSON body');
      })) as { op: AuthOp; args?: unknown[] } | null;
      const { op, args } = body ?? {};
      return json((await dispatch(op as AuthOp, args ?? [], req)) ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
