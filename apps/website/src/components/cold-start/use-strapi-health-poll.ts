"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicStrapiGraphqlEndpoint,
  pingStrapiGraphql,
} from "@/lib/strapi-health";

const POLL_INTERVAL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;

export type StrapiHealthPollState = {
  isReady: boolean;
  attemptCount: number;
  elapsedMs: number;
};

const READY_POLL_STATE: StrapiHealthPollState = {
  isReady: true,
  attemptCount: 0,
  elapsedMs: 0,
};

export function useStrapiHealthPoll(enabled: boolean): StrapiHealthPollState {
  const [pollState, setPollState] = useState<StrapiHealthPollState>(() =>
    enabled
      ? { isReady: false, attemptCount: 0, elapsedMs: 0 }
      : READY_POLL_STATE,
  );
  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pingOnce = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const apiResponse = await fetch("/api/strapi-health", {
        signal: controller.signal,
      });

      if (apiResponse.ok) {
        const body = (await apiResponse.json()) as { ready?: boolean };
        if (body.ready) {
          return true;
        }
      }
    } catch {
      // Static export or dev without API route — fall through to direct fetch.
    } finally {
      window.clearTimeout(timeoutId);
    }

    try {
      const result = await pingStrapiGraphql({
        endpoint: getPublicStrapiGraphqlEndpoint(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      return result.ready;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    startedAtRef.current = Date.now();

    let cancelled = false;
    let pollTimeoutId: number | undefined;

    const tick = async () => {
      if (cancelled) {
        return;
      }

      setPollState((current) => ({
        ...current,
        attemptCount: current.attemptCount + 1,
      }));

      const ready = await pingOnce();

      if (cancelled) {
        return;
      }

      if (ready) {
        setPollState((current) => ({ ...current, isReady: true }));
        return;
      }

      pollTimeoutId = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    const elapsedIntervalId = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setPollState((current) => ({
          ...current,
          elapsedMs: Date.now() - startedAtRef.current!,
        }));
      }
    }, 250);

    void tick();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (pollTimeoutId !== undefined) {
        window.clearTimeout(pollTimeoutId);
      }
      window.clearInterval(elapsedIntervalId);
    };
  }, [enabled, pingOnce]);

  if (!enabled) {
    return READY_POLL_STATE;
  }

  return pollState;
}
