'use client';

/**
 * Which tone an inspect-mode control needs to stay visible against whatever is
 * behind it.
 *
 * The add affordances are deliberately background-less — they have to read as a
 * *gap in the page*, not as chrome floating over it, which is the whole point of
 * editing in place. That worked until they landed on a dark section: hovering
 * darkened the text further (`hover:text-neutral-900`) against a navy CTA band,
 * so the button vanished at the exact moment the pointer was on it.
 *
 * A fixed dark chrome would fix it and lose the in-place feel, and a hardcoded
 * per-section list would rot the first time an editor picks a new background. So
 * measure instead: walk up for the first ancestor that actually paints something,
 * and decide from its luminance.
 */

import { useEffect, useState } from 'react';

export type SurfaceTone = 'light' | 'dark';

/** `rgb(9 16 33 / 0.8)` / `rgba(9,16,33,0.8)` -> channels + alpha. */
function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const nums = value.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [r, g, b, a] = nums.map(Number);
  return { r, g, b, a: nums.length > 3 ? a : 1 };
}

/** WCAG relative luminance (sRGB, gamma-corrected). 0 = black, 1 = white. */
function luminance(r: number, g: number, b: number): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The tone of the nearest painted background behind `node`.
 *
 * Transparent and mostly-transparent layers are skipped rather than composited:
 * what matters is the colour a viewer actually sees, and that comes from the
 * first ancestor opaque enough to hide what's under it.
 */
export function surfaceToneOf(node: Element | null): SurfaceTone {
  let el: Element | null = node;
  while (el) {
    const color = parseColor(getComputedStyle(el).backgroundColor);
    if (color && color.a > 0.5) {
      return luminance(color.r, color.g, color.b) < 0.5 ? 'dark' : 'light';
    }
    el = el.parentElement;
  }
  // Nothing paints all the way up — the page background is the browser default.
  return 'light';
}

/**
 * Hook form: pass the element the control is rendered into.
 *
 * Defaults to `light` until measured, matching the historical styling, so the
 * first paint is never the wrong-and-invisible combination. Re-measures whenever
 * `deps` change (e.g. inspect flipping on), since a control mounted while its
 * section was still rendering can measure too early.
 */
export function useSurfaceTone(node: Element | null, deps: unknown[] = []): SurfaceTone {
  const [tone, setTone] = useState<SurfaceTone>('light');

  useEffect(() => {
    if (!node) return;
    setTone(surfaceToneOf(node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ...deps]);

  return tone;
}
