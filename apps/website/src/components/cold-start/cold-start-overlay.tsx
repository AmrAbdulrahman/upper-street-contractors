"use client";

import { HouseBuildingAnimation } from "./house-building-animation";

type ColdStartOverlayProps = {
  attemptCount?: number;
  elapsedMs?: number;
  isBusy?: boolean;
  isExiting?: boolean;
};

export function ColdStartOverlay({
  attemptCount,
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
      <HouseBuildingAnimation attemptCount={attemptCount} elapsedMs={elapsedMs} />
    </div>
  );
}
