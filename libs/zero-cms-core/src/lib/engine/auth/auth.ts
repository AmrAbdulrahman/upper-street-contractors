/**
 * Auth service — users stored per-record via {@link StoragePort} (ADR 0009: no
 * single cached array — every lookup fetches fresh, every mutation is a CAS
 * against the stored `updatedAt`, same shape as content Entries). scrypt
 * password hashing, HS256 session tokens.
 */

import { Mutex } from '../mutex';
import { newId } from '../ids';
import { ZeroCmsError } from '../../model/errors';
import type { StoragePort } from '../storage-port';
import {
  toSafeUser,
  type Role,
  type SafeUser,
  type Session,
  type User,
} from '../../model/user';
import { hashPassword, verifyPassword } from './password';
import { signToken, verifyToken } from './token';
import { nextTimestamp } from '../clock';

export interface AuthOptions {
  /** HMAC secret for signing tokens. Required. */
  secret: string;
  /** Token lifetime in seconds. Default 7 days. */
  tokenTtlSec?: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  photo?: string;
  forcePasswordUpdate?: boolean;
}

export type UpdateUserInput = Partial<{
  email: string;
  firstName: string;
  lastName: string;
  photo: string;
  role: Role;
  disabled: boolean;
  forcePasswordUpdate: boolean;
}>;

const now = nextTimestamp;

export class Auth {
  private readonly mutex = new Mutex();

  private constructor(
    private readonly port: StoragePort,
    private readonly secret: string,
    private readonly ttl: number
  ) {}

  static async load(port: StoragePort, opts: AuthOptions): Promise<Auth> {
    if (!opts.secret) throw new Error('zero-cms auth: a `secret` is required');
    return new Auth(port, opts.secret, opts.tokenTtlSec ?? 7 * 86400);
  }

  private issue(u: User): string {
    return signToken(
      { sub: u.__id, email: u.email, role: u.role, fpu: u.forcePasswordUpdate },
      this.secret,
      this.ttl
    );
  }

  async count(): Promise<number> {
    return (await this.port.listUserIds()).length;
  }
  async list(): Promise<SafeUser[]> {
    const ids = await this.port.listUserIds();
    const users = await Promise.all(ids.map((id) => this.port.readUser(id)));
    return users.filter((u): u is User => u !== null).map(toSafeUser);
  }
  async get(id: string): Promise<SafeUser | null> {
    const u = await this.port.readUser(id);
    return u ? toSafeUser(u) : null;
  }

  // ---- admin user management ---------------------------------------------

  async createUser(input: CreateUserInput, actor = 'system'): Promise<SafeUser> {
    return this.mutex.run(async () => {
      if (!input.email?.trim() || !input.password)
        throw new ZeroCmsError('VALIDATION', 'email and password are required');
      if (await this.port.readUserByEmail(input.email))
        throw new ZeroCmsError('CONFLICT', `User "${input.email}" already exists`);
      const ts = now();
      const user: User = {
        __id: newId(),
        email: input.email.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        photo: input.photo,
        role: input.role ?? 'editor',
        hashedPassword: hashPassword(input.password),
        forcePasswordUpdate: input.forcePasswordUpdate ?? false,
        createdAt: ts,
        updatedAt: ts,
        lastEditedBy: actor,
      };
      // No CAS — a freshly generated id cannot collide with a concurrent write.
      await this.port.createUser(user);
      return toSafeUser(user);
    });
  }

  async updateUser(
    id: string,
    patch: UpdateUserInput,
    actor: string,
    expectedUpdatedAt: string
  ): Promise<SafeUser> {
    return this.mutex.run(async () => {
      const u = await this.port.readUser(id);
      if (!u) throw new ZeroCmsError('NOT_FOUND', `No user "${id}"`);
      const next: User = { ...u };
      if (patch.email && patch.email.trim().toLowerCase() !== u.email.toLowerCase()) {
        if (await this.port.readUserByEmail(patch.email))
          throw new ZeroCmsError('CONFLICT', `User "${patch.email}" already exists`);
        next.email = patch.email.trim();
      }
      if (patch.firstName !== undefined) next.firstName = patch.firstName;
      if (patch.lastName !== undefined) next.lastName = patch.lastName;
      if (patch.photo !== undefined) next.photo = patch.photo;
      if (patch.role !== undefined) next.role = patch.role;
      if (patch.disabled !== undefined) next.disabled = patch.disabled;
      if (patch.forcePasswordUpdate !== undefined)
        next.forcePasswordUpdate = patch.forcePasswordUpdate;
      next.updatedAt = now();
      next.lastEditedBy = actor;
      const ok = await this.port.writeUser(id, expectedUpdatedAt, next);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `User "${id}" was changed by someone else since you last read it — reload and retry`
        );
      return toSafeUser(next);
    });
  }

  /** Admin sets a user's password (clears the force-update flag). */
  async setPassword(
    id: string,
    newPassword: string,
    actor: string,
    expectedUpdatedAt: string
  ): Promise<SafeUser> {
    return this.mutex.run(async () => {
      const u = await this.port.readUser(id);
      if (!u) throw new ZeroCmsError('NOT_FOUND', `No user "${id}"`);
      const next: User = {
        ...u,
        hashedPassword: hashPassword(newPassword),
        forcePasswordUpdate: false,
        updatedAt: now(),
        lastEditedBy: actor,
      };
      const ok = await this.port.writeUser(id, expectedUpdatedAt, next);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `User "${id}" was changed by someone else since you last read it — reload and retry`
        );
      return toSafeUser(next);
    });
  }

  async deleteUser(id: string, expectedUpdatedAt: string): Promise<void> {
    return this.mutex.run(async () => {
      const ok = await this.port.deleteUser(id, expectedUpdatedAt);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `User "${id}" was changed by someone else since you last read it — reload and retry`
        );
    });
  }

  // ---- sessions ----------------------------------------------------------

  async login(email: string, password: string): Promise<{ token: string; user: SafeUser }> {
    const u = await this.port.readUserByEmail(email);
    if (!u || u.disabled || !verifyPassword(password, u.hashedPassword))
      throw new ZeroCmsError('UNAUTHORIZED', 'Invalid email or password');
    return { token: this.issue(u), user: toSafeUser(u) };
  }

  /** Verify a token → live session, or null. */
  async verify(token: string | null | undefined): Promise<Session | null> {
    if (!token) return null;
    const p = verifyToken(token, this.secret);
    if (!p) return null;
    const u = await this.port.readUser(p.sub);
    if (!u || u.disabled) return null;
    return {
      userId: u.__id,
      email: u.email,
      role: u.role,
      forcePasswordUpdate: u.forcePasswordUpdate,
    };
  }

  async me(token: string | null | undefined): Promise<SafeUser | null> {
    const s = await this.verify(token);
    return s ? this.get(s.userId) : null;
  }

  /** A logged-in user changes their own password (used for forcePasswordUpdate). */
  async changeOwnPassword(
    token: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ token: string; user: SafeUser }> {
    const session = await this.verify(token);
    if (!session) throw new ZeroCmsError('UNAUTHORIZED', 'Not signed in');
    if (!newPassword) throw new ZeroCmsError('VALIDATION', 'New password is required');
    return this.mutex.run(async () => {
      const u = await this.port.readUser(session.userId);
      if (!u || !verifyPassword(currentPassword, u.hashedPassword))
        throw new ZeroCmsError('UNAUTHORIZED', 'Current password is incorrect');
      const next: User = {
        ...u,
        hashedPassword: hashPassword(newPassword),
        forcePasswordUpdate: false,
        updatedAt: now(),
        lastEditedBy: session.userId,
      };
      const ok = await this.port.writeUser(u.__id, u.updatedAt, next);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          'Your account was changed elsewhere since you last read it — reload and retry'
        );
      return { token: this.issue(next), user: toSafeUser(next) };
    });
  }

  /** Seed the first admin from env if no users exist yet. Returns the seeded user. */
  async seedFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<SafeUser | null> {
    if ((await this.count()) > 0) return null;
    const email = env['ZERO_CMS_ADMIN_EMAIL'];
    const password = env['ZERO_CMS_ADMIN_PASSWORD'];
    if (!email || !password) return null;
    return this.createUser(
      { email, password, role: 'admin', forcePasswordUpdate: true },
      'system'
    );
  }
}
