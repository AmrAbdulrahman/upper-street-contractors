"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { detectSurfaceTone, type SurfaceTone } from "./detect-surface-tone";

export function useSurfaceTone(ref: RefObject<HTMLElement | null>): SurfaceTone {
  const [tone, setTone] = useState<SurfaceTone>("light");

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const updateTone = () => {
      setTone(detectSurfaceTone(element));
    };

    updateTone();

    const observer = new ResizeObserver(updateTone);
    observer.observe(element);

    if (element.parentElement) {
      observer.observe(element.parentElement);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return tone;
}
