"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PencilIcon } from "@/components/strapi/pencil-icon";
import { PublishAllButton } from "@/components/edit-drawer/publish-all-button";
import {
  ADMIN_BANNER_BG,
  ADMIN_BANNER_HEIGHT_PX,
  ADMIN_BANNER_MINIMIZED_KEY,
  ADMIN_BANNER_OFFSET_VAR,
} from "./constants";
import { InspectModeToggle } from "./inspect-mode-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageMetadataInspectButtonClient } from "../metadata/page-metadata-inspect-button-client";
import { CmsCallMeter } from "@/components/dev/cms-call-meter";

// Local-dev only. `process.env.NODE_ENV` is statically replaced at build time, so
// deployed builds (incl. staging, where this banner DOES render) drop the meter.
const isDev = process.env.NODE_ENV === "development";

type AdminBannerProps = {
  siteMetaConfigId?: string | null;
};

function subscribeToMinimizedChanges(listener: () => void): () => void {
  window.addEventListener("admin-banner-minimized", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("admin-banner-minimized", listener);
    window.removeEventListener("storage", listener);
  };
}

function getMinimizedSnapshot(): boolean {
  return localStorage.getItem(ADMIN_BANNER_MINIMIZED_KEY) === "true";
}

function getMinimizedServerSnapshot(): boolean {
  return false;
}

function setMinimized(minimized: boolean): void {
  localStorage.setItem(ADMIN_BANNER_MINIMIZED_KEY, minimized ? "true" : "false");
  window.dispatchEvent(new Event("admin-banner-minimized"));
}

function MinimizeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

function PreviewFabIcon() {
  return <PencilIcon className="h-4 w-4" />;
}

export function AdminBanner({ siteMetaConfigId }: AdminBannerProps) {
  const strapiUrl =
    process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";
  const minimized = useSyncExternalStore(
    subscribeToMinimizedChanges,
    getMinimizedSnapshot,
    getMinimizedServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.style.setProperty(
      ADMIN_BANNER_OFFSET_VAR,
      minimized ? "0px" : `${ADMIN_BANNER_HEIGHT_PX}px`,
    );
    return () => {
      document.documentElement.style.removeProperty(ADMIN_BANNER_OFFSET_VAR);
    };
  }, [minimized]);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Expand preview admin banner"
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white shadow-lg transition-[filter,transform] hover:brightness-110 active:scale-95"
        style={{ backgroundColor: ADMIN_BANNER_BG }}
      >
        <PreviewFabIcon />
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-100 flex h-9 items-center justify-end gap-3 border-b border-white/20 px-3 text-white sm:px-4"
        style={{ backgroundColor: ADMIN_BANNER_BG }}
        role="region"
        aria-label="Preview admin"
      >
        {isDev ? <CmsCallMeter variant="dark" className="mr-auto" /> : null}

        <div className="flex min-w-0 items-center gap-2">
          <PageMetadataInspectButtonClient
            strapiUrl={strapiUrl}
            siteMetaConfigId={siteMetaConfigId}
            placement="banner"
          />
          <InspectModeToggle />
          <PublishAllButton />
          <LogoutButton />
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize preview admin banner"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/15"
        >
          <MinimizeIcon />
        </button>
      </div>
      <div
        className="h-9 shrink-0"
        style={{ height: ADMIN_BANNER_HEIGHT_PX }}
        aria-hidden="true"
      />
    </>
  );
}
