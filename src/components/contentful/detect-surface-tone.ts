export type SurfaceTone = "light" | "dark";

const RGB_PATTERN =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/;

function parseRgb(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = color.match(RGB_PATTERN);

  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const normalized = value / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(r) +
    0.7152 * channel(g) +
    0.0722 * channel(b)
  );
}

function toneFromOpaqueBackground(backgroundColor: string): SurfaceTone | null {
  const rgb = parseRgb(backgroundColor);

  if (!rgb || rgb.a < 0.5) {
    return null;
  }

  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.5 ? "light" : "dark";
}

function walkSurfaceTone(
  start: HTMLElement | null,
  includeStart: boolean,
): SurfaceTone {
  let node: HTMLElement | null = includeStart ? start : start?.parentElement ?? null;

  while (node && node !== document.documentElement) {
    const tone = toneFromOpaqueBackground(getComputedStyle(node).backgroundColor);

    if (tone) {
      return tone;
    }

    node = node.parentElement;
  }

  return "light";
}

/** Check the element's own background, then walk ancestors; default light. */
export function surfaceToneAtElement(element: HTMLElement): SurfaceTone {
  return walkSurfaceTone(element, true);
}

/** Walk ancestors until an opaque background is found; default light (page surface). */
export function detectSurfaceTone(element: HTMLElement): SurfaceTone {
  return walkSurfaceTone(element, false);
}
