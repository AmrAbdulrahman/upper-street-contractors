/**
 * Auth model — users live in `<dir>/users.json` (never a database).
 *
 * `hashedPassword` never leaves the server; the API exposes {@link SafeUser}.
 */

export type Role = 'admin' | 'editor' | 'viewer';

export const ROLES: Role[] = ['admin', 'editor', 'viewer'];

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
