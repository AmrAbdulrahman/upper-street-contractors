'use client';

/**
 * Browser auth client — talks to the CMS auth endpoint (default `/api/cms/auth`),
 * stores the Bearer token in localStorage, and exposes login / me / changePassword.
 */

import { ZeroCmsError, type SafeUser } from '@usc/zero-cms-core';

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
    logout() {
      setToken(null);
    },
  };
}
