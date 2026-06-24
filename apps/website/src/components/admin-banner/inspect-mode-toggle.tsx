"use client";

import { PencilIcon } from "@/components/strapi/pencil-icon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const envInspectLocked =
  process.env.NEXT_PUBLIC_STRAPI_INSPECTION_MODE === "true";

function isInspectSearchParamEnabled(searchParams: URLSearchParams): boolean {
  return searchParams.get("inspect") === "true";
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function InspectModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const enabled =
    envInspectLocked || isInspectSearchParamEnabled(searchParams);

  const toggle = () => {
    if (envInspectLocked) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (isInspectSearchParamEnabled(searchParams)) {
      params.delete("inspect");
    } else {
      params.set("inspect", "true");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={envInspectLocked}
      aria-pressed={enabled}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-white transition-colors ${
        enabled
          ? "border-white bg-white/25"
          : "border-white/60 bg-transparent hover:bg-white/15"
      } disabled:cursor-default disabled:opacity-80`}
    >
      {enabled ? (
        <>
          <CloseIcon />
          <span>Turn off edit mode</span>
        </>
      ) : (
        <>
          <PencilIcon className="h-3.5 w-3.5 shrink-0" />
          <span>Turn on edit mode</span>
        </>
      )}
    </button>
  );
}
