"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

// Ends the editor session: revokes the refresh token + clears cookies via
// /api/auth/logout, then refreshes so the gate shows the login screen again.
// Styled to match the other AdminBanner controls.
export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () =>
    startTransition(async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Best-effort; still refresh to re-evaluate the session below.
      }
      toast.success("Signed out");
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-white/60 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
