"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StrapiEntryRef = {
  documentId?: string | null;
  __typename?: string | null;
};

export type StrapiEntryContextValue = {
  entry: StrapiEntryRef;
  entryId: string;
  typename?: string | null;
};

const StrapiEntryContext =
  createContext<StrapiEntryContextValue | null>(null);

export function getStrapiEntryId(entry: StrapiEntryRef): string {
  return entry.documentId ?? "";
}

export type StrapiEntryProviderProps = {
  entry: StrapiEntryRef;
  children: ReactNode;
};

export function StrapiEntryProvider({
  entry,
  children,
}: StrapiEntryProviderProps) {
  const entryId = getStrapiEntryId(entry);

  return (
    <StrapiEntryContext.Provider
      value={{ entry, entryId, typename: entry.__typename }}
    >
      {children}
    </StrapiEntryContext.Provider>
  );
}

export function useStrapiEntry(): StrapiEntryContextValue | null {
  return useContext(StrapiEntryContext);
}
