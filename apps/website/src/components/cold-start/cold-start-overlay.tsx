"use client";

import { HouseBuildingAnimation } from "./house-building-animation";
import { CmsCallMeter } from "@/components/dev/cms-call-meter";

// Local-dev only (statically dropped from deployed builds).
const isDev = process.env.NODE_ENV === "development";

type ColdStartOverlayProps = {
  elapsedMs?: number;
  isBusy?: boolean;
  isExiting?: boolean;
};

export function ColdStartOverlay({
  elapsedMs,
  isBusy = true,
  isExiting = false,
}: ColdStartOverlayProps) {
  return (
    <div
      className={`cold-start-overlay fixed inset-0 z-[100] flex items-center justify-center bg-surface${
        isExiting ? " cold-start-overlay--exiting" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-busy={isBusy}
    >
      {isDev ? (
        <div className="absolute left-4 top-4">
          <CmsCallMeter />
        </div>
      ) : null}
      <HouseBuildingAnimation elapsedMs={elapsedMs} />
    </div>
  );
}
