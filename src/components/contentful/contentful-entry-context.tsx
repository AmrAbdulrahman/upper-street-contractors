"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ContentfulEntryRef = {
  sys?: { id: string } | null;
  _id?: string | null;
};

export type ContentfulEntryContextValue = {
  entry: ContentfulEntryRef;
  entryId: string;
};

const ContentfulEntryContext =
  createContext<ContentfulEntryContextValue | null>(null);

export function getContentfulEntryId(entry: ContentfulEntryRef): string {
  return entry.sys?.id ?? entry._id ?? "";
}

export type ContentfulEntryProviderProps = {
  entry: ContentfulEntryRef;
  children: ReactNode;
};

export function ContentfulEntryProvider({
  entry,
  children,
}: ContentfulEntryProviderProps) {
  const entryId = getContentfulEntryId(entry);

  return (
    <ContentfulEntryContext.Provider value={{ entry, entryId }}>
      {children}
    </ContentfulEntryContext.Provider>
  );
}

export function useContentfulEntry(): ContentfulEntryContextValue | null {
  return useContext(ContentfulEntryContext);
}
