/**
 * Auth service — users in `users.json`, scrypt password hashing, HS256 session
 * tokens. In-memory with write-through (mutex), mirroring the content Engine.
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

const now = () => new Date().toISOString();

export class Auth {
  private readonly mutex = new Mutex();

  private constructor(
    private readonly port: StoragePort,
    private readonly secret: string,
    private readonly ttl: number,
    private users: User[]
  ) {}

  static async load(port: StoragePort, opts: AuthOptions): Promise<Auth> {
    if (!opts.secret) throw new Error('zero-cms auth: a `secret` is required');
    const users = (await port.readUsers()) ?? [];
    return new Auth(port, opts.secret, opts.tokenTtlSec ?? 7 * 86400, users);
  }

  private byEmail(email: string): User | undefined {
    const e = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === e);
  }
  private byId(id: string): User | undefined {
    return this.users.find((u) => u.__id === id);
  }
  private async persist() {
    await this.port.writeUsers(this.users);
  }
  private issue(u: User): string {
    return signToken(
      { sub: u.__id, email: u.email, role: u.role, fpu: u.forcePasswordUpdate },
      this.secret,
      this.ttl
    );
  }

  count(): number {
    return this.users.length;
  }
  list(): SafeUser[] {
    return this.users.map(toSafeUser);
  }
  get(id: string): SafeUser | null {
    const u = this.byId(id);
    return u ? toSafeUser(u) : null;
  }

  // ---- admin user management ---------------------------------------------

  async createUser(input: CreateUserInput): Promise<SafeUser> {
    return this.mutex.run(async () => {
      if (!input.email?.trim() || !input.password)
        throw new ZeroCmsError('VALIDATION', 'email and password are required');
      if (this.byEmail(input.email))
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
      };
      this.users.push(user);
      await this.persist();
      return toSafeUser(user);
    });
  }

  async updateUser(id: string, patch: UpdateUserInput): Promise<SafeUser> {
    return this.mutex.run(async () => {
      const u = this.byId(id);
      if (!u) throw new ZeroCmsError('NOT_FOUND', `No user "${id}"`);
      if (patch.email && patch.email.trim().toLowerCase() !== u.email.toLowerCase()) {
        if (this.byEmail(patch.email))
          throw new ZeroCmsError('CONFLICT', `User "${patch.email}" already exists`);
        u.email = patch.email.trim();
      }
      if (patch.firstName !== undefined) u.firstName = patch.firstName;
      if (patch.lastName !== undefined) u.lastName = patch.lastName;
      if (patch.photo !== undefined) u.photo = patch.photo;
      if (patch.role !== undefined) u.role = patch.role;
      if (patch.disabled !== undefined) u.disabled = patch.disabled;
      if (patch.forcePasswordUpdate !== undefined)
        u.forcePasswordUpdate = patch.forcePasswordUpdate;
      u.updatedAt = now();
      await this.persist();
      return toSafeUser(u);
    });
  }

  /** Admin sets a user's password (clears the force-update flag). */
  async setPassword(id: string, newPassword: string): Promise<SafeUser> {
    return this.mutex.run(async () => {
      const u = this.byId(id);
      if (!u) throw new ZeroCmsError('NOT_FOUND', `No user "${id}"`);
      u.hashedPassword = hashPassword(newPassword);
      u.forcePasswordUpdate = false;
      u.updatedAt = now();
      await this.persist();
      return toSafeUser(u);
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.mutex.run(async () => {
      this.users = this.users.filter((u) => u.__id !== id);
      await this.persist();
    });
  }

  // ---- sessions ----------------------------------------------------------

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: SafeUser }> {
    const u = this.byEmail(email);
    if (!u || u.disabled || !verifyPassword(password, u.hashedPassword))
      throw new ZeroCmsError('UNAUTHORIZED', 'Invalid email or password');
    return { token: this.issue(u), user: toSafeUser(u) };
  }

  /** Verify a token → live session, or null. */
  verify(token: string | null | undefined): Session | null {
    if (!token) return null;
    const p = verifyToken(token, this.secret);
    if (!p) return null;
    const u = this.byId(p.sub);
    if (!u || u.disabled) return null;
    return {
      userId: u.__id,
      email: u.email,
      role: u.role,
      forcePasswordUpdate: u.forcePasswordUpdate,
    };
  }

  me(token: string | null | undefined): SafeUser | null {
    const s = this.verify(token);
    return s ? this.get(s.userId) : null;
  }

  /** A logged-in user changes their own password (used for forcePasswordUpdate). */
  async changeOwnPassword(
    token: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ token: string; user: SafeUser }> {
    const session = this.verify(token);
    if (!session) throw new ZeroCmsError('UNAUTHORIZED', 'Not signed in');
    if (!newPassword)
      throw new ZeroCmsError('VALIDATION', 'New password is required');
    return this.mutex.run(async () => {
      const u = this.byId(session.userId);
      if (!u || !verifyPassword(currentPassword, u.hashedPassword))
        throw new ZeroCmsError('UNAUTHORIZED', 'Current password is incorrect');
      u.hashedPassword = hashPassword(newPassword);
      u.forcePasswordUpdate = false;
      u.updatedAt = now();
      await this.persist();
      return { token: this.issue(u), user: toSafeUser(u) };
    });
  }

  /** Seed the first admin from env if no users exist yet. Returns the seeded user. */
  async seedFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<SafeUser | null> {
    if (this.users.length > 0) return null;
    const email = env['ZERO_CMS_ADMIN_EMAIL'];
    const password = env['ZERO_CMS_ADMIN_PASSWORD'];
    if (!email || !password) return null;
    return this.createUser({
      email,
      password,
      role: 'admin',
      forcePasswordUpdate: true,
    });
  }
}
