"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  FIELD_LABEL_CLASS,
  FIELD_TYPE_BADGE_CLASS,
  humanizeFieldName,
} from "../ui";

export function FieldRow({
  name,
  strapiType,
  focused,
  children,
}: {
  name: string;
  strapiType: string;
  focused?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focused]);

  return (
    <div
      ref={ref}
      className={[
        "rounded-lg p-3 transition-shadow",
        focused
          ? "outline outline-2 outline-dashed outline-offset-2 outline-gold bg-gold/5 shadow-[0_0_0_4px_rgba(184,134,58,0.18)]"
          : "outline-none",
      ].join(" ")}
    >
      <div className={FIELD_LABEL_CLASS}>
        <span>{humanizeFieldName(name)}</span>
        <span className={FIELD_TYPE_BADGE_CLASS}>{strapiType}</span>
      </div>
      {children}
    </div>
  );
}
