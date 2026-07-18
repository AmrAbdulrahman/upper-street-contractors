'use client';

/**
 * ZeroCmsProvider — supplies the injected {@link Adapter}, the loaded Schema, the
 * media list, and the pluggable rich-text editor to the whole app. Everything in
 * zero-cms-app is schema-driven and talks to the generic Adapter, so the app is
 * environment-independent (no router, no framework coupling).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { Adapter, Schema, MediaItem, BlocksContent } from '@usc/zero-cms-core';
import { BlocksEditor } from '@usc/zero-cms-blocks';
import { DraftRegistryProvider } from './draft-registry';
import { cls, cx } from './components/ui';

export type RichTextComponent = ComponentType<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>;

/**
 * Pluggable editor for `blocks` fields. Mirrors {@link RichTextComponent} but
 * speaks the structured {@link BlocksContent} tree. Defaults to the dependency-free
 * {@link BlocksEditor}; a host can inject a richer one (e.g. a HugeRTE-backed
 * WYSIWYG that converts blocks↔HTML internally) via `<ZeroCmsProvider blocks={…}>`.
 */
export type BlocksComponent = ComponentType<{
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
}>;

/**
 * Host-injected notifier for mutation feedback (toasts). The lib stays
 * framework-free — the host wires this to its toast lib (e.g. sonner) and passes
 * it via `<ZeroCmsProvider notify={…}>`. Defaults to a no-op when unset.
 */
export type NotifyFn = (kind: 'success' | 'error', message: string) => void;

const noopNotify: NotifyFn = () => {};

interface ZeroCmsContextValue {
  adapter: Adapter;
  schema: Schema;
  /** The version to present back to `adapter.saveSchema` (ADR 0009) — fetched fresh alongside `schema`. */
  schemaVersion: string | null;
  schemaLoading: boolean;
  refreshSchema: () => Promise<void>;
  media: MediaItem[];
  refreshMedia: () => Promise<void>;
  RichText: RichTextComponent;
  Blocks: BlocksComponent;
  notify: NotifyFn;
  /**
   * Caller identity for every mutation (ADR 0009 — required, no anonymous
   * default at the engine). The server derives the *real* actor from the
   * verified session when auth is enabled and ignores this value, but it's
   * still the right thing to send: it's what makes the call meaningful when
   * auth is off (open/dev adapters), and self-documenting either way.
   * Defaults to `'anonymous'` only for the no-auth `<ZeroCmsProvider adapter>`
   * path, which has no signed-in user to draw from at all.
   */
  currentUserId: string;
}

const ZeroCmsContext = createContext<ZeroCmsContextValue | null>(null);

/** Default rich-text editor: a plain textarea so the lib needs no editor dep. */
const DefaultRichText: RichTextComponent = ({ value, onChange, placeholder }) => (
  <textarea
    className={cx(cls.input, 'min-h-32 font-mono text-sm')}
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);

export interface ZeroCmsProviderProps {
  adapter: Adapter;
  richText?: RichTextComponent;
  /** Editor for `blocks` fields; defaults to the built-in {@link BlocksEditor}. */
  blocks?: BlocksComponent;
  /** Toast notifier for mutation feedback; defaults to a no-op. */
  notify?: NotifyFn;
  /** The signed-in user's id, when there is one (see {@link ZeroCmsContextValue.currentUserId}). */
  currentUserId?: string;
  children: ReactNode;
}

export function ZeroCmsProvider({
  adapter,
  richText,
  blocks,
  notify,
  currentUserId,
  children,
}: ZeroCmsProviderProps) {
  const [schema, setSchema] = useState<Schema>([]);
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Loads tolerate failure: with the widget the adapter may be unauthenticated
  // before sign-in (the admin RPC is session-gated), so getSchema/listMedia 401.
  // We clear to empty instead of throwing an unhandled rejection; the effect re-runs
  // when the adapter changes (a token-bearing adapter after login) and succeeds.
  const refreshSchema = useCallback(async () => {
    setSchemaLoading(true);
    try {
      // The version is auxiliary — if only it fails (e.g. an op-level 403 like
      // the F9 regression), keep the schema instead of blanking the dashboard.
      const [next, version] = await Promise.all([
        adapter.getSchema(),
        adapter.getSchemaVersion().catch(() => null),
      ]);
      setSchema(next);
      setSchemaVersion(version);
    } catch {
      setSchema([]);
      setSchemaVersion(null);
    } finally {
      setSchemaLoading(false);
    }
  }, [adapter]);

  const refreshMedia = useCallback(async () => {
    try {
      setMedia(await adapter.listMedia());
    } catch {
      setMedia([]);
    }
  }, [adapter]);

  useEffect(() => {
    void refreshSchema();
    void refreshMedia();
  }, [refreshSchema, refreshMedia]);

  const value = useMemo<ZeroCmsContextValue>(
    () => ({
      adapter,
      schema,
      schemaVersion,
      schemaLoading,
      refreshSchema,
      media,
      refreshMedia,
      RichText: richText ?? DefaultRichText,
      Blocks: blocks ?? BlocksEditor,
      notify: notify ?? noopNotify,
      currentUserId: currentUserId ?? 'anonymous',
    }),
    [
      adapter,
      schema,
      schemaVersion,
      schemaLoading,
      refreshSchema,
      media,
      refreshMedia,
      richText,
      blocks,
      notify,
      currentUserId,
    ]
  );

  return (
    <ZeroCmsContext.Provider value={value}>
      <DraftRegistryProvider>{children}</DraftRegistryProvider>
    </ZeroCmsContext.Provider>
  );
}

export function useZeroCms(): ZeroCmsContextValue {
  const ctx = useContext(ZeroCmsContext);
  if (!ctx) throw new Error('useZeroCms must be used within <ZeroCmsProvider>');
  return ctx;
}

/**
 * Like {@link useZeroCms} but returns null instead of throwing when there is no
 * <ZeroCmsProvider>. Used by components that also render on public pages (no
 * provider mounted), e.g. <ZeroCmsList> reading schema-driven limits in inspect
 * mode while staying inert in production.
 */
export function useZeroCmsOptional(): ZeroCmsContextValue | null {
  return useContext(ZeroCmsContext);
}
