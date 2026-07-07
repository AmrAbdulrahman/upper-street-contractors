'use client';

/**
 * Carries the current entry's id + type down to nested <ZeroCmsEntryField>s, so a
 * field wrapper can open the right entry focused on itself. Accepts either the
 * store shape (`__id`/`__type`) or the GraphQL shape (`id`/`type`).
 */

import { createContext, useContext, type ReactNode } from 'react';

export type ZeroCmsEntryRef = {
  id?: string | null;
  __id?: string | null;
  type?: string | null;
  __type?: string | null;
};

export function entryRefId(entry: ZeroCmsEntryRef): string {
  return entry.id ?? entry.__id ?? '';
}

export function entryRefType(entry: ZeroCmsEntryRef): string | null {
  return entry.type ?? entry.__type ?? null;
}

export interface ZeroCmsEntryContextValue {
  entryId: string;
  typeName: string | null;
}

const Ctx = createContext<ZeroCmsEntryContextValue | null>(null);

export function ZeroCmsEntryProvider({
  entry,
  children,
}: {
  entry: ZeroCmsEntryRef;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider
      value={{ entryId: entryRefId(entry), typeName: entryRefType(entry) }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useZeroCmsEntry(): ZeroCmsEntryContextValue | null {
  return useContext(Ctx);
}
