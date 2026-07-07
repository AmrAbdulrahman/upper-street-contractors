import { describe, it, expect, beforeEach } from 'vitest';
import { Auth } from './auth';
import { createMemoryStoragePort } from '../fs-storage-port';

async function freshAuth() {
  return Auth.load(createMemoryStoragePort(), { secret: 'test-secret' });
}

describe('Auth', () => {
  let auth: Auth;
  beforeEach(async () => {
    auth = await freshAuth();
  });

  it('creates a user, hides the password, and logs in', async () => {
    const u = await auth.createUser({
      email: 'Jo@Example.com',
      password: 'pw1',
      role: 'admin',
      firstName: 'Jo',
    });
    expect(u).not.toHaveProperty('hashedPassword');
    expect(await auth.count()).toBe(1);

    await expect(auth.login('jo@example.com', 'wrong')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    const { token, user } = await auth.login('jo@example.com', 'pw1'); // case-insensitive
    expect(user.role).toBe('admin');
    const session = await auth.verify(token);
    expect(session).toMatchObject({ userId: u.__id, role: 'admin' });
  });

  it('rejects duplicate emails and bad tokens', async () => {
    await auth.createUser({ email: 'a@b.com', password: 'x' });
    await expect(
      auth.createUser({ email: 'a@b.com', password: 'y' })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await auth.verify('not.a.token')).toBeNull();
    expect(await auth.verify(null)).toBeNull();
  });

  it('changes own password and clears forcePasswordUpdate', async () => {
    const u = await auth.createUser({
      email: 'c@d.com',
      password: 'old',
      forcePasswordUpdate: true,
    });
    const { token } = await auth.login('c@d.com', 'old');
    expect((await auth.verify(token))?.forcePasswordUpdate).toBe(true);

    await expect(
      auth.changeOwnPassword(token, 'nope', 'new')
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const after = await auth.changeOwnPassword(token, 'old', 'newpass');
    expect(after.user.forcePasswordUpdate).toBe(false);
    expect((await auth.verify(after.token))?.forcePasswordUpdate).toBe(false);
    await expect(auth.login('c@d.com', 'newpass')).resolves.toBeTruthy();
    expect(u.email).toBe('c@d.com');
  });

  it('seeds the first admin from env only when empty', async () => {
    const env = {
      ZERO_CMS_ADMIN_EMAIL: 'root@site.com',
      ZERO_CMS_ADMIN_PASSWORD: 'secret',
    } as NodeJS.ProcessEnv;
    const seeded = await auth.seedFromEnv(env);
    expect(seeded?.role).toBe('admin');
    expect(seeded?.forcePasswordUpdate).toBe(true);
    expect(await auth.seedFromEnv(env)).toBeNull(); // not empty anymore
  });

  it('disabled users cannot log in or verify', async () => {
    const u = await auth.createUser({ email: 'e@f.com', password: 'pw' });
    const { token } = await auth.login('e@f.com', 'pw');
    await auth.updateUser(u.__id, { disabled: true }, 'admin-id', u.updatedAt);
    expect(await auth.verify(token)).toBeNull();
    await expect(auth.login('e@f.com', 'pw')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('updateUser rejects a stale expectedUpdatedAt (ADR 0009)', async () => {
    const u = await auth.createUser({ email: 'g@h.com', password: 'pw' });
    await auth.updateUser(u.__id, { firstName: 'First' }, 'admin-id', u.updatedAt);
    // u.updatedAt is now stale — the update above already bumped it.
    await expect(
      auth.updateUser(u.__id, { firstName: 'Second' }, 'admin-id', u.updatedAt)
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
