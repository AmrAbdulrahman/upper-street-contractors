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
      password: 'password1',
      role: 'admin',
      firstName: 'Jo',
    });
    expect(u).not.toHaveProperty('hashedPassword');
    expect(await auth.count()).toBe(1);

    await expect(auth.login('jo@example.com', 'wrong')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    const { token, user } = await auth.login('jo@example.com', 'password1'); // case-insensitive
    expect(user.role).toBe('admin');
    const session = await auth.verify(token);
    expect(session).toMatchObject({ userId: u.__id, role: 'admin' });
  });

  it('rejects duplicate emails and bad tokens', async () => {
    await auth.createUser({ email: 'a@b.com', password: 'password-x' });
    await expect(
      auth.createUser({ email: 'a@b.com', password: 'password-y' })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await auth.verify('not.a.token')).toBeNull();
    expect(await auth.verify(null)).toBeNull();
  });

  it('rejects passwords under 8 characters on every setting path', async () => {
    await expect(
      auth.createUser({ email: 'short@pw.com', password: 'seven77' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const u = await auth.createUser({ email: 'ok@pw.com', password: 'long-enough' });
    await expect(
      auth.setPassword(u.__id, 'seven77', 'admin-id', u.updatedAt)
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const { token } = await auth.login('ok@pw.com', 'long-enough');
    await expect(
      auth.changeOwnPassword(token, 'long-enough', 'seven77')
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('changes own password and clears forcePasswordUpdate', async () => {
    const u = await auth.createUser({
      email: 'c@d.com',
      password: 'old-password',
      forcePasswordUpdate: true,
    });
    const { token } = await auth.login('c@d.com', 'old-password');
    expect((await auth.verify(token))?.forcePasswordUpdate).toBe(true);

    await expect(
      auth.changeOwnPassword(token, 'nope-nope', 'new-password')
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const after = await auth.changeOwnPassword(token, 'old-password', 'new-password');
    expect(after.user.forcePasswordUpdate).toBe(false);
    expect((await auth.verify(after.token))?.forcePasswordUpdate).toBe(false);
    await expect(auth.login('c@d.com', 'new-password')).resolves.toBeTruthy();
    expect(u.email).toBe('c@d.com');
  });

  it('setPassword sets or clears forcePasswordUpdate per the flag', async () => {
    const u = await auth.createUser({ email: 'reset@pw.com', password: 'password-0' });

    const forced = await auth.setPassword(u.__id, 'temp-password', 'admin-id', u.updatedAt, true);
    expect(forced.forcePasswordUpdate).toBe(true);
    const { token } = await auth.login('reset@pw.com', 'temp-password');
    expect((await auth.verify(token))?.forcePasswordUpdate).toBe(true);

    const kept = await auth.setPassword(
      u.__id,
      'final-password',
      'admin-id',
      forced.updatedAt
    );
    expect(kept.forcePasswordUpdate).toBe(false); // default: a plain reset, no forced rotation
  });

  it('seeds the first admin from env only when empty', async () => {
    const env = {
      ZERO_CMS_ADMIN_EMAIL: 'root@site.com',
      ZERO_CMS_ADMIN_PASSWORD: 'seed-secret',
    } as NodeJS.ProcessEnv;
    const seeded = await auth.seedFromEnv(env);
    expect(seeded?.role).toBe('admin');
    expect(seeded?.forcePasswordUpdate).toBe(true);
    expect(await auth.seedFromEnv(env)).toBeNull(); // not empty anymore
  });

  it('disabled users cannot log in or verify', async () => {
    const u = await auth.createUser({ email: 'e@f.com', password: 'password-e' });
    const { token } = await auth.login('e@f.com', 'password-e');
    await auth.updateUser(u.__id, { disabled: true }, 'admin-id', u.updatedAt);
    expect(await auth.verify(token)).toBeNull();
    await expect(auth.login('e@f.com', 'password-e')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('updateUser rejects a stale expectedUpdatedAt (ADR 0009)', async () => {
    const u = await auth.createUser({ email: 'g@h.com', password: 'password-g' });
    await auth.updateUser(u.__id, { firstName: 'First' }, 'admin-id', u.updatedAt);
    // u.updatedAt is now stale — the update above already bumped it.
    await expect(
      auth.updateUser(u.__id, { firstName: 'Second' }, 'admin-id', u.updatedAt)
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
