"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ContentfulInspectionContextValue = {
  enabled: boolean;
  spaceId: string;
  environmentId: string;
};

const ContentfulInspectionContext =
  createContext<ContentfulInspectionContextValue | null>(null);

function isInspectionSearchParamEnabled(
  searchParams: URLSearchParams,
): boolean {
  return searchParams.get("inspect") === "true";
}

function isInspectionEnabled(searchParams: URLSearchParams): boolean {
  const envEnabled =
    process.env.NEXT_PUBLIC_CONTENTFUL_INSPECTION_MODE === "true";

  return envEnabled || isInspectionSearchParamEnabled(searchParams);
}

/** Inspect overlays are client-only; keep SSR/hydration markup identical. */
function subscribeToInspectionChanges() {
  return () => {};
}

export type ContentfulInspectionProviderProps = {
  children: ReactNode;
  spaceId: string;
  environmentId?: string;
};

export function ContentfulInspectionProvider({
  children,
  spaceId,
  environmentId = "master",
}: ContentfulInspectionProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const enabled = useSyncExternalStore(
    subscribeToInspectionChanges,
    () => isInspectionEnabled(searchParams),
    () => false,
  );

  const value = useMemo<ContentfulInspectionContextValue>(
    () => ({
      enabled,
      spaceId,
      environmentId,
    }),
    [enabled, spaceId, environmentId],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onFocus = () => {
      router.refresh();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, router]);

  return (
    <ContentfulInspectionContext.Provider value={value}>
      {children}
    </ContentfulInspectionContext.Provider>
  );
}

export function useContentfulInspection(): ContentfulInspectionContextValue {
  const context = useContext(ContentfulInspectionContext);

  if (!context) {
    return {
      enabled: false,
      spaceId: "",
      environmentId: "master",
    };
  }

  return context;
}
