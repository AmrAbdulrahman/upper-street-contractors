import { describe, it, expect } from 'vitest';
import { authorizeRpc } from './authorize';
import type { RpcOp } from '../adapter/protocol';
import type { Role, Session } from '../model/user';

/**
 * Full role × RPC-op matrix for the admin RPC surface (authorizeRpc). Companion
 * to auth-handler.spec.ts (which covers the forcePasswordUpdate gate + user-admin
 * self-guards). This asserts the *documented* permission contract op-by-op.
 * Regression note: getSchemaVersion once fell through to deny-by-default,
 * blanking the dashboard for non-admins (TEST-REPORT F9) — it must stay viewer+.
 */

const session = (role: Role, over: Partial<Session> = {}): Session => ({
  userId: `u-${role}`,
  email: `${role}@site.com`,
  role,
  forcePasswordUpdate: false,
  ...over,
});

const allows = (op: RpcOp, role: Role): boolean => {
  try {
    authorizeRpc(op, session(role));
    return true;
  } catch {
    return false;
  }
};

/** Every wire op, grouped by the role it is *intended* to require. */
const READ_OPS: RpcOp[] = [
  'getSchema',
  'getSchemaVersion',
  'get',
  'query',
  'listDrafts',
  'validateRefs',
  'locate',
  'listMedia',
  'getMedia',
];
const CONTENT_WRITE_OPS: RpcOp[] = [
  'create',
  'update',
  'patch',
  'delete',
  'publish',
  'unpublish',
  'discardDraft',
  'putMedia',
  'updateMedia',
  'deleteMedia',
];
const ADMIN_OPS: RpcOp[] = ['saveSchema'];

describe('authorizeRpc — role × op matrix', () => {
  it('rejects an absent session as UNAUTHORIZED, whatever the op', () => {
    expect(() => authorizeRpc('query', null)).toThrowError(/Sign in/i);
    expect(() => authorizeRpc('saveSchema', null)).toThrowError(/Sign in/i);
  });

  it('lets every role perform read ops', () => {
    for (const op of READ_OPS) {
      for (const role of ['viewer', 'editor', 'admin'] as const) {
        expect(allows(op, role), `${role} should read "${op}"`).toBe(true);
      }
    }
  });

  it('blocks viewers from content writes; allows editor and admin', () => {
    for (const op of CONTENT_WRITE_OPS) {
      expect(allows(op, 'viewer'), `viewer must NOT ${op}`).toBe(false);
      expect(allows(op, 'editor'), `editor should ${op}`).toBe(true);
      expect(allows(op, 'admin'), `admin should ${op}`).toBe(true);
    }
  });

  it('restricts admin-only ops (saveSchema) to admins', () => {
    for (const op of ADMIN_OPS) {
      expect(allows(op, 'viewer'), `viewer must NOT ${op}`).toBe(false);
      expect(allows(op, 'editor'), `editor must NOT ${op}`).toBe(false);
      expect(allows(op, 'admin'), `admin should ${op}`).toBe(true);
    }
  });

  it('denies an unknown op by default (deny-by-default)', () => {
    expect(allows('frobnicate' as RpcOp, 'admin')).toBe(true); // admin passes the ?? "admin" default
    expect(allows('frobnicate' as RpcOp, 'editor')).toBe(false);
  });
});
