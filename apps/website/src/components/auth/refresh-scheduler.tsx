"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mounted (by LoginGateShell) only while an editor session is active. RSC reads
// can't refresh the token themselves (no cookie writes during render), so this
// rotates the httpOnly cookies on an interval well inside the CMS
// accessTokenLifespan (1h), keeping server reads authenticated. If the refresh
// token is dead, it refreshes the route so the gate falls back to the login screen.
const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45m < 1h access lifespan

export function RefreshScheduler() {
  const router = useRouter();

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) router.refresh();
      } catch {
        // Network blip — try again next interval.
      }
    };

    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
