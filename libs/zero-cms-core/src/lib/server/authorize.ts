/**
 * Authorization policy for the admin RPC surface. Published GraphQL reads stay
 * public (enforced in the GraphQL layer); the RPC transport is admin-only.
 */

import { ZeroCmsError } from '../model/errors';
import { roleAtLeast, type Role, type Session } from '../model/user';

export function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Minimum role per RPC op. Unknown ops default to `admin` (deny by default). */
const RPC_MIN_ROLE: Record<string, Role> = {
  // view only
  getSchema: 'viewer',
  getSchemaVersion: 'viewer',
  get: 'viewer',
  query: 'viewer',
  listDrafts: 'viewer',
  validateRefs: 'viewer',
  locate: 'viewer',
  listMedia: 'viewer',
  getMedia: 'viewer',

  // edit content
  create: 'editor',
  update: 'editor',
  patch: 'editor',
  delete: 'editor',
  publish: 'editor',
  unpublish: 'editor',
  discardDraft: 'editor',
  putMedia: 'editor',
  updateMedia: 'editor',
  deleteMedia: 'editor',

  // edit content types
  saveSchema: 'admin',
};

/** Throws UNAUTHORIZED (no/invalid session) or FORBIDDEN (insufficient role). */
export function authorizeRpc(op: string, session: Session | null): void {
  if (!session) throw new ZeroCmsError('UNAUTHORIZED', 'Sign in required');
  // A temp password (forced-change pending) opens nothing but the change-password
  // flow — without this, the token issued at login works on every RPC op before
  // the password is ever rotated.
  if (session.forcePasswordUpdate)
    throw new ZeroCmsError('FORBIDDEN', 'Change your password before continuing');
  const min = RPC_MIN_ROLE[op] ?? 'admin';
  if (!roleAtLeast(session.role, min))
    throw new ZeroCmsError('FORBIDDEN', `Requires "${min}" role`);
}
