"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useCmsCalls, visibleEntries } from "./cms-call-store";

// Panel (+ analytics) chunk loads only when opened. Mount sites gate on
// NODE_ENV === "development", so on deployed builds this never renders and the
// panel chunk is never requested.
const CmsCallPanel = dynamic(() => import("./cms-call-panel"), { ssr: false });

const VARIANT = {
  // For light backgrounds (login + cold-start screens).
  light: "border border-border bg-white text-dark shadow-sm hover:bg-border-light",
  // For the dark Preview admin bar.
  dark: "border border-white/40 text-white hover:bg-white/15",
} as const;

type CmsCallMeterProps = {
  variant?: keyof typeof VARIANT;
  className?: string;
};

/**
 * Local-dev CMS Call Meter: a compact pill showing how many times the site has
 * hit the Strapi CMS this session. Lives in the Preview admin bar (and the login
 * / cold-start screens). Click to open the panel.
 */
export function CmsCallMeter({ variant = "light", className = "" }: CmsCallMeterProps) {
  const [open, setOpen] = useState(false);
  const state = useCmsCalls();
  const count = visibleEntries(state).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Strapi CMS calls this session (local dev)"
        aria-label={`Strapi CMS calls this session: ${count}. Open details.`}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors ${VARIANT[variant]} ${className}`}
      >
        <span aria-hidden>⚡</span>
        <span className="tabular-nums">{count}</span>
        <span className="hidden text-[0.625rem] font-medium uppercase tracking-wide opacity-70 sm:inline">
          CMS
        </span>
      </button>
      {open ? <CmsCallPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}
