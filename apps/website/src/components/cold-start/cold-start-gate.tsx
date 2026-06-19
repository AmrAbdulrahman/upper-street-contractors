"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPublicStrapiGraphqlEndpoint,
  shouldEnableColdStartGate,
} from "@/lib/strapi-health";
import { ColdStartOverlay } from "./cold-start-overlay";
import { useStrapiHealthPoll } from "./use-strapi-health-poll";

const DEFAULT_EMULATE_DELAY_MS = 12_000;
const EXIT_TRANSITION_MS = 400;

type ColdStartGateProps = {
  children: React.ReactNode;
};

type GatePhase = "loading" | "exiting" | "done";

function parseEmulateDelay(value: string | null): number {
  if (!value) {
    return DEFAULT_EMULATE_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_EMULATE_DELAY_MS;
  }

  return parsed;
}

function ColdStartGateInner({ children }: ColdStartGateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emulateColdStart = searchParams.get("emulateColdStart") === "true";
  const emulateDelayMs = parseEmulateDelay(searchParams.get("emulateColdStartDelay"));
  const strapiUrl = getPublicStrapiGraphqlEndpoint().replace(/\/graphql$/, "");
  const gateEnabled = shouldEnableColdStartGate(strapiUrl, emulateColdStart);

  const { isReady, attemptCount, elapsedMs } = useStrapiHealthPoll(gateEnabled);
  const [minDelayElapsed, setMinDelayElapsed] = useState(!emulateColdStart);
  const [phase, setPhase] = useState<GatePhase>(gateEnabled ? "loading" : "done");

  useEffect(() => {
    if (!emulateColdStart) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMinDelayElapsed(true), emulateDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [emulateColdStart, emulateDelayMs]);

  const canDismiss =
    !gateEnabled ||
    (emulateColdStart && minDelayElapsed) ||
    (isReady && (!emulateColdStart || minDelayElapsed));

  useEffect(() => {
    if (!canDismiss || phase !== "loading") {
      return;
    }

    const exitTimer = window.setTimeout(() => {
      setPhase("exiting");
      window.setTimeout(() => setPhase("done"), EXIT_TRANSITION_MS);
    }, 0);

    return () => window.clearTimeout(exitTimer);
  }, [canDismiss, phase]);

  useEffect(() => {
    if (phase !== "done" || !gateEnabled) {
      return;
    }

    router.refresh();
  }, [gateEnabled, phase, router]);

  return (
    <>
      {phase !== "done" ? (
        <ColdStartOverlay
          attemptCount={attemptCount}
          elapsedMs={elapsedMs}
          isBusy={!canDismiss}
          isExiting={phase === "exiting"}
        />
      ) : null}
      <div
        className={`flex min-h-full flex-1 flex-col${phase === "done" ? "" : " invisible"}`}
        aria-hidden={phase !== "done"}
      >
        {children}
      </div>
    </>
  );
}

export function ColdStartGate({ children }: ColdStartGateProps) {
  return (
    <Suspense fallback={<ColdStartOverlay />}>
      <ColdStartGateInner>{children}</ColdStartGateInner>
    </Suspense>
  );
}
