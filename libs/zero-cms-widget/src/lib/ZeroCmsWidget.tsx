'use client';

/**
 * <ZeroCmsWidget> — wrap your app, then call `useZeroCmsWidget().openEntry(id)`
 * (e.g. from an edit pencil) to edit an entry in-place. Reuses zero-cms-app's
 * provider + EntryEditor inside an accessible slide-over drawer.
 *
 * Pass `adapter` directly, or `auth` to gate editing behind a login (the host
 * content still renders; the drawer shows a sign-in form until authenticated).
 */

import { useMemo, useState, type ReactNode } from 'react';
import { createHttpAdapter, type Adapter } from '@usc/zero-cms-core';
import {
  EntryEditor,
  ZeroCmsProvider,
  useZeroCms,
  createAuthClient,
  ui,
  type AuthClient,
  type AuthConfig,
  type RichTextComponent,
  type BlocksComponent,
  type NotifyFn,
} from '@usc/zero-cms-app';
import { Drawer } from './Drawer';
import { WidgetProvider, useWidgetInternal } from './context';

export interface ZeroCmsWidgetProps {
  adapter?: Adapter;
  /** Gate editing behind a login; the drawer manages the session. */
  auth?: AuthConfig;
  richText?: RichTextComponent;
  /** Editor for `blocks` fields; defaults to the built-in BlocksEditor. */
  blocks?: BlocksComponent;
  /** Toast notifier for mutation feedback; forwarded to the provider. */
  notify?: NotifyFn;
  /** Called after a successful create/update/publish/etc inside the drawer. */
  onSaved?: () => void;
  /**
   * Inspect mode: when true, `<ZeroCmsEntry>` / `<ZeroCmsEntryField>` render their
   * hover edit affordances. The host decides (e.g. from a `?inspect=true` param).
   */
  inspect?: boolean;
  children: ReactNode;
}

export function ZeroCmsWidget(props: ZeroCmsWidgetProps) {
  if (props.auth) return <AuthedWidget {...props} auth={props.auth} />;
  if (!props.adapter)
    throw new Error('ZeroCmsWidget requires either `adapter` or `auth`');
  return (
    <ZeroCmsProvider
      adapter={props.adapter}
      richText={props.richText}
      blocks={props.blocks}
      notify={props.notify}
    >
      <WidgetProvider inspect={props.inspect} onChanged={props.onSaved}>
        {props.children}
        <DrawerBody onSaved={props.onSaved} />
      </WidgetProvider>
    </ZeroCmsProvider>
  );
}

function AuthedWidget({
  auth,
  richText,
  blocks,
  notify,
  onSaved,
  inspect,
  children,
}: ZeroCmsWidgetProps & { auth: AuthConfig }) {
  const client = useMemo(
    () => createAuthClient(auth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.baseUrl, auth.authPath, auth.storageKey]
  );
  const [token, setToken] = useState<string | null>(client.token());
  const adapter = useMemo(
    () =>
      createHttpAdapter({
        baseUrl: auth.baseUrl ?? '',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [token, auth.baseUrl]
  );

  return (
    <ZeroCmsProvider adapter={adapter} richText={richText} blocks={blocks} notify={notify}>
      <WidgetProvider inspect={inspect} onChanged={onSaved}>
        {children}
        <DrawerBody onSaved={onSaved} client={client} token={token} onAuthed={setToken} />
      </WidgetProvider>
    </ZeroCmsProvider>
  );
}

function DrawerBody({
  onSaved,
  client,
  token,
  onAuthed,
}: {
  onSaved?: () => void;
  client?: AuthClient;
  token?: string | null;
  onAuthed?: (token: string) => void;
}) {
  const { isOpen, close, target, loading, error } = useWidgetInternal();
  const { schema } = useZeroCms();
  const type = target ? schema.find((t) => t.__name === target.type) : undefined;
  const needsLogin = Boolean(client) && !token;

  return (
    <Drawer open={isOpen} onClose={close} label="Edit entry">
      {needsLogin && client && onAuthed ? (
        <DrawerLogin client={client} onAuthed={onAuthed} />
      ) : (
        <>
          {loading && (
            <div className="py-10 text-center text-sm text-neutral-500">Loading…</div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {target && type && (
            <EntryEditor
              key={target.id}
              type={type}
              entryId={target.id}
              createMode={target.mode === 'create'}
              focusField={target.focusField}
              onClose={close}
              onChanged={() => onSaved?.()}
            />
          )}
          {target && !type && !loading && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Unknown type &quot;{target.type}&quot;
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

function DrawerLogin({
  client,
  onAuthed,
}: {
  client: AuthClient;
  onAuthed: (token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await client.login(email, password);
          onAuthed(r.token);
        } catch (ex) {
          setErr((ex as Error)?.message ?? 'Sign in failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-base font-semibold text-neutral-900">Sign in to edit</h3>
      <ui.Field label="Email">
        <ui.Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </ui.Field>
      <ui.Field label="Password">
        <ui.Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </ui.Field>
      {err && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      )}
      <ui.Button type="submit" variant="primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </ui.Button>
    </form>
  );
}
