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
import type { Adapter, Schema, MediaItem } from '@usc/zero-cms-core';
import { cls, cx } from './ui';

export type RichTextComponent = ComponentType<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>;

interface ZeroCmsContextValue {
  adapter: Adapter;
  schema: Schema;
  schemaLoading: boolean;
  refreshSchema: () => Promise<void>;
  media: MediaItem[];
  refreshMedia: () => Promise<void>;
  RichText: RichTextComponent;
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
  children: ReactNode;
}

export function ZeroCmsProvider({
  adapter,
  richText,
  children,
}: ZeroCmsProviderProps) {
  const [schema, setSchema] = useState<Schema>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Loads tolerate failure: with the widget the adapter may be unauthenticated
  // before sign-in (the admin RPC is session-gated), so getSchema/listMedia 401.
  // We clear to empty instead of throwing an unhandled rejection; the effect re-runs
  // when the adapter changes (a token-bearing adapter after login) and succeeds.
  const refreshSchema = useCallback(async () => {
    setSchemaLoading(true);
    try {
      setSchema(await adapter.getSchema());
    } catch {
      setSchema([]);
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
      schemaLoading,
      refreshSchema,
      media,
      refreshMedia,
      RichText: richText ?? DefaultRichText,
    }),
    [adapter, schema, schemaLoading, refreshSchema, media, refreshMedia, richText]
  );

  return <ZeroCmsContext.Provider value={value}>{children}</ZeroCmsContext.Provider>;
}

export function useZeroCms(): ZeroCmsContextValue {
  const ctx = useContext(ZeroCmsContext);
  if (!ctx) throw new Error('useZeroCms must be used within <ZeroCmsProvider>');
  return ctx;
}
