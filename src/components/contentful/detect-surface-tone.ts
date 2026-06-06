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

/** Walk ancestors until an opaque background is found; default light (page surface). */
export function detectSurfaceTone(element: HTMLElement): SurfaceTone {
  let node: HTMLElement | null = element.parentElement;

  while (node && node !== document.documentElement) {
    const { backgroundColor } = getComputedStyle(node);
    const rgb = parseRgb(backgroundColor);

    if (!rgb || rgb.a < 0.5) {
      node = node.parentElement;
      continue;
    }

    return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.5 ? "light" : "dark";
  }

  return "light";
}
