'use client';

/**
 * Auth gate — renders a login (and forced password-change) screen until the user
 * is authenticated, then hands an authed http {@link Adapter} + the current user to
 * `children`. Used internally by <ZeroCmsApp> / <ZeroCmsWidget> when `auth` is set.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createHttpAdapter, type Adapter, type SafeUser } from '@usc/zero-cms-core';
import { createAuthClient, type AuthClient } from './auth-client';
import { Button, Field, Input, Spinner, cls, cx } from '../components/ui';
import { errorMessage } from '../util';

export interface AuthConfig {
  baseUrl?: string;
  authPath?: string;
  storageKey?: string;
}

export interface AuthContext {
  user: SafeUser;
  logout: () => void;
  /** The signed-in auth client — carries the live token for user-admin ops. */
  client: AuthClient;
}

type Phase = 'loading' | 'login' | 'changePassword' | 'ready';

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="zero-cms flex min-h-[24rem] items-center justify-center p-6">
      {children}
    </div>
  );
}

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Centered>
      <div className={cx(cls.card, 'w-full max-w-sm space-y-4 p-6')}>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {children}
      </div>
    </Centered>
  );
}

function ErrorMsg({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>
  );
}

function LoginForm({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (email: string, password: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <AuthCard title="Sign in">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(email, password);
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}

function ChangePasswordForm({
  onSubmit,
  onLogout,
  busy,
  error,
}: {
  onSubmit: (current: string, next: string) => void;
  onLogout: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = next !== '' && next !== confirm;
  return (
    <AuthCard title="Set a new password">
      <p className="text-sm text-neutral-500">
        You must set a new password before continuing.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mismatch) onSubmit(current, next);
        }}
      >
        <Field label="Current password">
          <Input
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined}>
          <Input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy || mismatch}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
          <Button type="button" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

export function AuthGate({
  config,
  children,
}: {
  config: AuthConfig;
  children: (adapter: Adapter, ctx: AuthContext) => ReactNode;
}) {
  const client = useMemo(
    () => createAuthClient(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.baseUrl, config.authPath, config.storageKey]
  );
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setTok] = useState<string | null>(client.token());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const me = await client.me();
      if (!live) return;
      if (me) {
        setUser(me);
        setTok(client.token());
        setPhase(me.forcePasswordUpdate ? 'changePassword' : 'ready');
      } else {
        setPhase('login');
      }
    })();
    return () => {
      live = false;
    };
  }, [client]);

  const adapter = useMemo(
    () =>
      token
        ? createHttpAdapter({
            baseUrl: config.baseUrl ?? '',
            headers: { Authorization: `Bearer ${token}` },
          })
        : null,
    [token, config.baseUrl]
  );

  const logout = useCallback(() => {
    client.logout();
    setUser(null);
    setTok(null);
    setError(null);
    setPhase('login');
  }, [client]);

  const onLogin = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.login(email, password);
      setUser(r.user);
      setTok(r.token);
      setPhase(r.user.forcePasswordUpdate ? 'changePassword' : 'ready');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (cur: string, next: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.changePassword(cur, next);
      setUser(r.user);
      setTok(r.token);
      setPhase('ready');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading')
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  if (phase === 'login')
    return <LoginForm onSubmit={onLogin} busy={busy} error={error} />;
  if (phase === 'changePassword')
    return (
      <ChangePasswordForm
        onSubmit={onChangePassword}
        onLogout={logout}
        busy={busy}
        error={error}
      />
    );
  if (!adapter || !user)
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  return <>{children(adapter, { user, logout, client })}</>;
}
