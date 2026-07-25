"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ConsentPlaceholder } from "@/components/consent/consent-placeholder";
import { useHasConsent } from "@/lib/consent/use-consent";

const TRUSTPILOT_BOOTSTRAP =
  "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";

const BUSINESS_UNIT_ID = "69a014cb7a802e7c5ea1df91";
const TOKEN = "f10fb5d1-2609-4e1b-8427-e4c88338878f";
const REVIEW_URL = "https://uk.trustpilot.com/review/upperstreet.contractors";

export const TRUSTPILOT_VARIANTS = [
  "mini",
  "micro-combo",
  "micro-review-count",
  "review-collector",
] as const;

export type TrustpilotVariant = (typeof TRUSTPILOT_VARIANTS)[number];

/**
 * `micro-combo` sizing. Unlike `mini`, this template does NOT scale its content
 * to `data-style-height` — the ink renders at a fixed size, top-anchored, and
 * any extra height is just dead space below it (which reads as the badge being
 * misaligned against anything centred beside it). So the box has to match the
 * ink exactly, and the ink's height depends on whether it wraps:
 *
 *   >= 420px wide -> one line  ("Excellent ***** 482 reviews on Trustpilot")
 *   <  420px wide -> two lines, and 24px would clip the second one.
 *
 * Both numbers are measured from the rendered widget, not from Trustpilot docs.
 */
const MICRO_COMBO_ONE_LINE_WIDTH = 420;
const MICRO_COMBO_ONE_LINE_HEIGHT = 24;
const MICRO_COMBO_TWO_LINE_HEIGHT = 48;

type VariantConfig = {
  templateId: string;
  styleHeight: string;
  styleWidth: string;
  wrapperClassName: string;
};

const VARIANT_CONFIG: Record<TrustpilotVariant, VariantConfig> = {
  mini: {
    templateId: "53aa8807dec7e10d38f59f32",
    styleHeight: "130px",
    styleWidth: "100%",
    wrapperClassName: "w-fit",
  },
  "micro-combo": {
    templateId: "5419b6ffb0d04a076446a9af",
    styleHeight: `${MICRO_COMBO_ONE_LINE_HEIGHT}px`,
    styleWidth: "100%",
    // Not `w-fit`: fit-content leaves this template at the vendor's ~300px
    // default, which is just too narrow for one line. Cap at the one-line width
    // instead and let it shrink below that. Literal class (Tailwind's JIT can't
    // scan an interpolated one) — keep in sync with MICRO_COMBO_ONE_LINE_WIDTH.
    wrapperClassName: "w-full max-w-[420px]",
  },
  "micro-review-count": {
    templateId: "5419b6a8b0d04a076446a9ad",
    styleHeight: "24px",
    styleWidth: "100%",
    wrapperClassName: "w-fit",
  },
  "review-collector": {
    templateId: "56278e9abfbbba0bdcd568bc",
    styleHeight: "52px",
    styleWidth: "100%",
    wrapperClassName: "w-fit",
  },
};

type TrustpilotWidgetProps = {
  className?: string;
  variant?: TrustpilotVariant;
};

declare global {
  interface Window {
    Trustpilot?: {
      loadFromElement: (element: HTMLElement | null, force?: boolean) => void;
    };
  }
}

function loadTrustpilotWidget(element: HTMLDivElement | null) {
  if (!element) return;
  window.Trustpilot?.loadFromElement(element, true);
}

export function TrustpilotWidget({
  className,
  variant = "mini",
}: TrustpilotWidgetProps) {
  const allowed = useHasConsent("functional");
  const widgetRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const config = VARIANT_CONFIG[variant];

  // `micro-combo` only: watch our own box rather than the viewport, since this
  // widget sits in a wrap-capable row — the same viewport width can leave it
  // sharing a line or occupying one alone, which changes whether it wraps.
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  useEffect(() => {
    if (variant !== "micro-combo" || !allowed) return;
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBoxWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant, allowed]);

  const styleHeight =
    variant === "micro-combo" && boxWidth !== null
      ? `${boxWidth >= MICRO_COMBO_ONE_LINE_WIDTH ? MICRO_COMBO_ONE_LINE_HEIGHT : MICRO_COMBO_TWO_LINE_HEIGHT}px`
      : config.styleHeight;

  useEffect(() => {
    // Consent gate: only touch the vendor API once functional cookies are allowed.
    if (!allowed) return;
    loadTrustpilotWidget(widgetRef.current);
  }, [variant, styleHeight, allowed]);

  // No consent → render an inert badge-sized prompt, never the vendor <Script>.
  if (!allowed) {
    return (
      <ConsentPlaceholder
        variant="inline"
        label="Trustpilot reviews"
        className={className}
      />
    );
  }

  return (
    <>
      <Script
        src={TRUSTPILOT_BOOTSTRAP}
        strategy="afterInteractive"
        onReady={() => loadTrustpilotWidget(widgetRef.current)}
      />
      <div
        ref={wrapperRef}
        className={[config.wrapperClassName, className].filter(Boolean).join(" ")}
      >
        <div
          // Keyed on both so crossing the wrap threshold remounts the host div —
          // the vendor injects an iframe on load and never re-reads
          // `data-style-height` afterwards.
          key={`${variant}:${styleHeight}`}
          ref={widgetRef}
          className="trustpilot-widget"
          data-locale="en-GB"
          data-template-id={config.templateId}
          data-businessunit-id={BUSINESS_UNIT_ID}
          data-style-height={styleHeight}
          data-style-width={config.styleWidth}
          data-theme="light"
          data-token={TOKEN}
        >
          <a
            href={REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Trustpilot
          </a>
        </div>
      </div>
    </>
  );
}
