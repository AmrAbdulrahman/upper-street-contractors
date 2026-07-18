import { describe, it, expect, beforeEach } from 'vitest';
import { Auth } from '../engine/auth/auth';
import { createMemoryStoragePort } from '../engine/fs-storage-port';
import { createAuthHandler } from './auth-handler';
import { authorizeRpc } from './authorize';
import type { Session } from '../model/user';

function request(op: string, args: unknown[], token?: string): Request {
  return new Request('http://test/api/cms/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ op, args }),
  });
}

describe('createAuthHandler', () => {
  let auth: Auth;
  let handle: (req: Request) => Promise<Response>;
  let adminToken: string;
  let adminId: string;

  const call = async (op: string, args: unknown[], token?: string) => {
    const res = await handle(request(op, args, token));
    return { status: res.status, body: (await res.json()) as never };
  };

  beforeEach(async () => {
    auth = await Auth.load(createMemoryStoragePort(), { secret: 'test-secret' });
    handle = createAuthHandler(auth);
    const admin = await auth.createUser({
      email: 'root@site.com',
      password: 'root-password',
      role: 'admin',
    });
    adminId = admin.__id;
    adminToken = (await auth.login('root@site.com', 'root-password')).token;
  });

  it('blocks admin ops while a forced password change is pending', async () => {
    await call(
      'createUser',
      [{ email: 'temp@site.com', password: 'temp-password', role: 'admin', forcePasswordUpdate: true }],
      adminToken
    );
    const pending = (await auth.login('temp@site.com', 'temp-password')).token;

    const denied = await call('listUsers', [], pending);
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ error: { code: 'FORBIDDEN' } });

    // The rotation path itself stays open, and clears the block.
    const rotated = await call('changePassword', ['temp-password', 'rotated-password'], pending);
    expect(rotated.status).toBe(200);
    const after = await call('listUsers', [], (rotated.body as { token: string }).token);
    expect(after.status).toBe(200);
  });

  it('rejects self-demotion, self-disabling, and self-deletion', async () => {
    const me = await auth.get(adminId);

    for (const patch of [{ role: 'editor' }, { disabled: true }]) {
      const res = await call('updateUser', [adminId, patch, me?.updatedAt], adminToken);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }

    const del = await call('deleteUser', [adminId, me?.updatedAt], adminToken);
    expect(del.status).toBe(403);

    // Harmless self-edits still work.
    const rename = await call('updateUser', [adminId, { firstName: 'Root' }, me?.updatedAt], adminToken);
    expect(rename.status).toBe(200);
  });

  it('setPassword forwards the force flag', async () => {
    const created = (
      await call(
        'createUser',
        [{ email: 'w@site.com', password: 'first-password', role: 'editor' }],
        adminToken
      )
    ).body as { __id: string; updatedAt: string };

    const reset = await call(
      'setPassword',
      [created.__id, 'temp-password2', created.updatedAt, true],
      adminToken
    );
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ forcePasswordUpdate: true });

    const session = await auth.verify((await auth.login('w@site.com', 'temp-password2')).token);
    expect(session?.forcePasswordUpdate).toBe(true);
  });

  it('rejects a malformed JSON body with 400, not 500 (F7)', async () => {
    const res = await handle(
      new Request('http://test/api/cms/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('rejects login with missing/empty credentials as 400 without leaking internals (F6)', async () => {
    for (const args of [[], [undefined, undefined], ['', ''], ['root@site.com']]) {
      const res = await call('login', args as unknown[]);
      expect(res.status, JSON.stringify(args)).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION' } });
      expect(JSON.stringify(res.body)).not.toMatch(/trim/i);
    }
  });

  it('denies user administration to non-admin roles', async () => {
    await call(
      'createUser',
      [{ email: 'copy@site.com', password: 'copy-password', role: 'editor' }],
      adminToken
    );
    const editorToken = (await auth.login('copy@site.com', 'copy-password')).token;
    const res = await call('listUsers', [], editorToken);
    expect(res.status).toBe(403);
  });
});

describe('authorizeRpc forcePasswordUpdate gate', () => {
  const session = (over: Partial<Session>): Session => ({
    userId: 'u1',
    email: 'u@site.com',
    role: 'editor',
    forcePasswordUpdate: false,
    ...over,
  });

  it('blocks every op while pending, at any role', () => {
    for (const role of ['admin', 'editor', 'viewer'] as const) {
      expect(() =>
        authorizeRpc('get', session({ role, forcePasswordUpdate: true }))
      ).toThrowError(/Change your password/);
    }
  });

  it('passes normal role checks when not pending', () => {
    expect(() => authorizeRpc('update', session({}))).not.toThrow();
    expect(() => authorizeRpc('saveSchema', session({}))).toThrowError(/admin/);
  });
});
