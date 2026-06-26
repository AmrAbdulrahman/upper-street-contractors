"use client";

import { useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type StrapiInspectionContextValue = {
  enabled: boolean;
  strapiUrl: string;
};

const StrapiInspectionContext =
  createContext<StrapiInspectionContextValue | null>(null);

function isInspectionSearchParamEnabled(
  searchParams: URLSearchParams,
): boolean {
  return searchParams.get("inspect") === "true";
}

function isInspectionEnabled(searchParams: URLSearchParams): boolean {
  const envEnabled =
    process.env.NEXT_PUBLIC_STRAPI_INSPECTION_MODE === "true";

  return envEnabled || isInspectionSearchParamEnabled(searchParams);
}

function subscribeToInspectionChanges() {
  return () => {};
}

export type StrapiInspectionProviderProps = {
  children: ReactNode;
  strapiUrl?: string;
};

export function StrapiInspectionProvider({
  children,
  strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337",
}: StrapiInspectionProviderProps) {
  const searchParams = useSearchParams();

  const enabled = useSyncExternalStore(
    subscribeToInspectionChanges,
    () => isInspectionEnabled(searchParams),
    () => false,
  );

  const value = useMemo<StrapiInspectionContextValue>(
    () => ({
      enabled,
      strapiUrl,
    }),
    [enabled, strapiUrl],
  );

  return (
    <StrapiInspectionContext.Provider value={value}>
      {children}
    </StrapiInspectionContext.Provider>
  );
}

export function useStrapiInspection(): StrapiInspectionContextValue {
  const context = useContext(StrapiInspectionContext);

  if (!context) {
    return {
      enabled: false,
      strapiUrl: process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337",
    };
  }

  return context;
}
