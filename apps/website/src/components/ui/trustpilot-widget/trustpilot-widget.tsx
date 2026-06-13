"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

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
    styleHeight: "20px",
    styleWidth: "100%",
    wrapperClassName: "w-fit",
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
  const widgetRef = useRef<HTMLDivElement>(null);
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    loadTrustpilotWidget(widgetRef.current);
  }, [variant]);

  return (
    <>
      <Script
        src={TRUSTPILOT_BOOTSTRAP}
        strategy="afterInteractive"
        onReady={() => loadTrustpilotWidget(widgetRef.current)}
      />
      <div
        className={[config.wrapperClassName, className].filter(Boolean).join(" ")}
      >
        <div
          key={variant}
          ref={widgetRef}
          className="trustpilot-widget"
          data-locale="en-GB"
          data-template-id={config.templateId}
          data-businessunit-id={BUSINESS_UNIT_ID}
          data-style-height={config.styleHeight}
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
