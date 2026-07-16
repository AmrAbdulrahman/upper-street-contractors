'use client';

/**
 * Browser auth client — talks to the CMS auth endpoint (default `/api/cms/auth`),
 * stores the Bearer token in localStorage, and exposes login / me / changePassword.
 */

import {
  ZeroCmsError,
  type CreateUserInput,
  type SafeUser,
  type UpdateUserInput,
} from '@usc/zero-cms-core';

export interface AuthClientOptions {
  /** Origin/base for the endpoint (default same-origin ''). */
  baseUrl?: string;
  /** Auth endpoint path. Default `/api/cms/auth`. */
  authPath?: string;
  storageKey?: string;
  fetch?: typeof fetch;
}

export interface LoginResult {
  token: string;
  user: SafeUser;
}

export interface AuthClient {
  token(): string | null;
  setToken(token: string | null): void;
  login(email: string, password: string): Promise<LoginResult>;
  me(): Promise<SafeUser | null>;
  changePassword(current: string, next: string): Promise<LoginResult>;
  logout(): void;
  // ---- user administration (server rejects below the `admin` role) ----
  listUsers(): Promise<SafeUser[]>;
  createUser(input: CreateUserInput): Promise<SafeUser>;
  /** `expectedUpdatedAt` = the `updatedAt` last read for this user (ADR 0009 CAS). */
  updateUser(id: string, patch: UpdateUserInput, expectedUpdatedAt: string): Promise<SafeUser>;
  /** Admin reset; `forcePasswordUpdate` = require rotation on next login. */
  setPassword(
    id: string,
    newPassword: string,
    expectedUpdatedAt: string,
    forcePasswordUpdate: boolean
  ): Promise<SafeUser>;
  deleteUser(id: string, expectedUpdatedAt: string): Promise<void>;
}

export function createAuthClient(opts: AuthClientOptions = {}): AuthClient {
  const doFetch = opts.fetch ?? fetch;
  const url = (opts.baseUrl ?? '').replace(/\/$/, '') + (opts.authPath ?? '/api/cms/auth');
  const storageKey = opts.storageKey ?? 'zero-cms-token';
  const hasStorage = typeof localStorage !== 'undefined';

  let tok: string | null = hasStorage ? localStorage.getItem(storageKey) : null;

  const setToken = (t: string | null) => {
    tok = t;
    if (!hasStorage) return;
    if (t) localStorage.setItem(storageKey, t);
    else localStorage.removeItem(storageKey);
  };

  async function rpc<T>(op: string, args: unknown[], authed = true): Promise<T> {
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authed && tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ op, args }),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: { code: string; message: string; details?: unknown } }
      | T
      | null;
    if (!res.ok) {
      const err = (body as { error?: { code: string; message: string; details?: unknown } })
        ?.error;
      throw new ZeroCmsError(
        (err?.code as never) ?? 'CONFLICT',
        err?.message ?? `Request failed (${res.status})`,
        err?.details
      );
    }
    return body as T;
  }

  return {
    token: () => tok,
    setToken,
    async login(email, password) {
      const r = await rpc<LoginResult>('login', [email, password], false);
      setToken(r.token);
      return r;
    },
    async me() {
      if (!tok) return null;
      try {
        return await rpc<SafeUser>('me', []);
      } catch (err) {
        if (err instanceof ZeroCmsError && err.code === 'UNAUTHORIZED') setToken(null);
        return null;
      }
    },
    async changePassword(current, next) {
      const r = await rpc<LoginResult>('changePassword', [current, next]);
      setToken(r.token);
      return r;
    },
    listUsers: () => rpc<SafeUser[]>('listUsers', []),
    createUser: (input) => rpc<SafeUser>('createUser', [input]),
    updateUser: (id, patch, expectedUpdatedAt) =>
      rpc<SafeUser>('updateUser', [id, patch, expectedUpdatedAt]),
    setPassword: (id, newPassword, expectedUpdatedAt, forcePasswordUpdate) =>
      rpc<SafeUser>('setPassword', [id, newPassword, expectedUpdatedAt, forcePasswordUpdate]),
    deleteUser: async (id, expectedUpdatedAt) => {
      await rpc<{ ok: true }>('deleteUser', [id, expectedUpdatedAt]);
    },
    logout() {
      setToken(null);
      // Best-effort — clears the httpOnly session cookie proxy.ts checks for
      // /admin/* (localStorage alone is invisible server-side, so leaving this
      // out would let the cookie outlive a "logged out" browser for its full
      // Max-Age). Not awaited: logout must clear local state immediately
      // regardless of network state.
      void doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'logout', args: [] }),
      }).catch(() => undefined);
    },
  };
}
