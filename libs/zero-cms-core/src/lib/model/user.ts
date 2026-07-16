/**
 * Auth model — users live in `<dir>/users.json` (never a database).
 *
 * `hashedPassword` never leaves the server; the API exposes {@link SafeUser}.
 */

export type Role = 'admin' | 'editor' | 'viewer';

export const ROLES: Role[] = ['admin', 'editor', 'viewer'];

/**
 * Display names — the `editor` role is presented as "Copy writer" everywhere
 * (the role *value* stays `editor`: same permissions, cheaper than a rename
 * through tokens/rank/stored users). Single source for every role picker/badge.
 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Copy writer',
  viewer: 'Viewer',
};

export interface User {
  __id: string;
  /** Login identifier, unique (case-insensitive). */
  email: string;
  firstName?: string;
  lastName?: string;
  /** Media id of the avatar. */
  photo?: string;
  role: Role;
  /** `scrypt$<salt>$<hash>` — server only. */
  hashedPassword: string;
  /** Force a password change on next login. */
  forcePasswordUpdate: boolean;
  /** Disabled users cannot log in. */
  disabled?: boolean;
  createdAt: string;
  /**
   * Bumped on every mutation. Doubles as the optimistic-concurrency token
   * (ADR 0009) — a mutating call must present the value it last read here.
   * Not `__`-prefixed like Entry's system fields: Users aren't Type-schema-driven,
   * so there's no user-defined-field collision risk to guard against.
   */
  updatedAt: string;
  /** Caller identity responsible for the last mutation. Required, no anonymous default. */
  lastEditedBy: string;
}

/** A user without secrets — the shape returned over the API. */
export type SafeUser = Omit<User, 'hashedPassword'>;

/**
 * Input shapes for the user-admin API. Plain data (no node dependencies) so
 * browser clients (zero-cms-app's auth client) can type their calls; the
 * node-side `Auth` service consumes the same shapes.
 */
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

/** The verified identity carried by a session token. */
export interface Session {
  userId: string;
  email: string;
  role: Role;
  /** True while the user must still set a new password. */
  forcePasswordUpdate: boolean;
}

export function toSafeUser(user: User): SafeUser {
  const { hashedPassword: _omit, ...safe } = user;
  return safe;
}

/** Role ranking for permission checks (`admin` ⊇ `editor` ⊇ `viewer`). */
export const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
