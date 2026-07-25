'use client';

/**
 * Wireframe glyphs for the Section Type picker — the abstract line-art preview
 * shown above each Type's label.
 *
 * A `Type.thumbnail` holds a KEY into this registry, not a media id. That looks
 * like a limitation ("a new Type needs a lib change for its glyph") but isn't:
 * a Type only becomes pickable once a host app ships a component, a fragment
 * and a union entry for it, so it is never a no-code operation — the glyph
 * rides along with that work and can never dangle, 404, or be deleted out from
 * under a Type the way a media item can. They also cost no network bytes and
 * follow `currentColor`.
 *
 * Unknown or absent keys fall back to {@link GENERIC_GLYPH}, so a Type with no
 * `thumbnail` still renders a sane cell.
 *
 * Lives in zero-cms-app rather than zero-cms-widget because the type-builder
 * (here) has to render the picker that CHOOSES a key, and widget→app is the only
 * legal direction between the two.
 */

import type { ReactElement } from 'react';
import { Field as FieldShell, Select } from '../ui';

/** Shared frame: a 64×40 box in the picker's own colours. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** A stack of text lines, `n` of them, the last one short. */
function Lines({ n, x = 8, width = 48, top = 10, gap = 6 }: {
  n: number;
  x?: number;
  width?: number;
  top?: number;
  gap?: number;
}) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <line
          key={i}
          x1={x}
          y1={top + i * gap}
          x2={x + (i === n - 1 ? width * 0.6 : width)}
          y2={top + i * gap}
        />
      ))}
    </>
  );
}

/** The picture-frame mark used wherever a glyph needs "an image". */
function Frame({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="2" />
      <path d={`M${x + 2} ${y + h - 3} l${w * 0.3} -${h * 0.45} l${w * 0.25} ${h * 0.3} l${w * 0.2} -${h * 0.2}`} />
      <circle cx={x + w - 4} cy={y + 4} r="1.5" />
    </>
  );
}

export const GENERIC_GLYPH: ReactElement = (
  <Glyph>
    <rect x="8" y="8" width="48" height="24" rx="2" strokeDasharray="3 3" />
  </Glyph>
);

export const TYPE_GLYPHS: Record<string, ReactElement> = {
  /** Rich Text — stacked lines only. */
  richText: (
    <Glyph>
      <Lines n={5} />
    </Glyph>
  ),

  /** Image with Text — a frame beside lines. */
  imageText: (
    <Glyph>
      <Frame x={8} y={10} w={22} h={20} />
      <Lines n={4} x={36} width={20} top={12} gap={5} />
    </Glyph>
  ),

  /** Image — one wide frame. */
  image: (
    <Glyph>
      <Frame x={10} y={8} w={44} h={24} />
    </Glyph>
  ),

  /** Gallery — a 3×2 grid of tiles. */
  gallery: (
    <Glyph>
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => (
          <rect key={`${c}-${r}`} x={8 + c * 16} y={9 + r * 12} width="14" height="10" rx="1.5" />
        ))
      )}
    </Glyph>
  ),

  /** Quote — an oversized opening quote mark over a short line. */
  quote: (
    <Glyph>
      <path d="M18 12 q-5 0 -5 6 q0 5 5 5 q4 0 4 -4 q0 -4 -4 -4" />
      <path d="M32 12 q-5 0 -5 6 q0 5 5 5 q4 0 4 -4 q0 -4 -4 -4" />
      <line x1="18" y1="30" x2="46" y2="30" />
    </Glyph>
  ),

  /** FAQ — rows each ending in a chevron. */
  faq: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line x1="8" y1={11 + i * 9} x2="44" y2={11 + i * 9} />
          <path d={`M50 ${8 + i * 9} l3 3 l-3 3`} />
        </g>
      ))}
    </Glyph>
  ),

  /** Call to Action — a line of copy above a filled pill button. */
  cta: (
    <Glyph>
      <Lines n={2} x={14} width={36} top={10} />
      <rect x="22" y="24" width="20" height="9" rx="4.5" fill="currentColor" stroke="none" />
    </Glyph>
  ),

  /** Separator — a dashed rule with breathing room. */
  separator: (
    <Glyph>
      <line x1="8" y1="20" x2="56" y2="20" strokeDasharray="5 4" />
    </Glyph>
  ),

  /** Hero — a full frame with a title bar across it. */
  hero: (
    <Glyph>
      <rect x="8" y="7" width="48" height="26" rx="2" />
      <line x1="16" y1="17" x2="42" y2="17" />
      <line x1="16" y1="24" x2="32" y2="24" />
    </Glyph>
  ),

  /** Card List — three captioned cards in a row. */
  cardList: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={8 + i * 16} y="9" width="14" height="12" rx="1.5" />
          <line x1={8 + i * 16} y1="26" x2={20 + i * 16} y2="26" />
        </g>
      ))}
    </Glyph>
  ),

  /** Video — a frame with a play triangle. */
  video: (
    <Glyph>
      <rect x="10" y="8" width="44" height="24" rx="2" />
      <path d="M29 14 l9 6 l-9 6 z" fill="currentColor" stroke="none" />
    </Glyph>
  ),

  /** Wizard / form — labelled input rows. */
  form: (
    <Glyph>
      {[0, 1].map((i) => (
        <g key={i}>
          <line x1="8" y1={10 + i * 13} x2="24" y2={10 + i * 13} />
          <rect x="8" y={14 + i * 13} width="48" height="7" rx="1.5" />
        </g>
      ))}
    </Glyph>
  ),

  /** A logo/badge strip. */
  logoStrip: (
    <Glyph>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={7 + i * 13} y="14" width="10" height="12" rx="1.5" />
      ))}
    </Glyph>
  ),
};

/** The glyph for a `Type.thumbnail` key, falling back to the generic frame. */
export function typeGlyph(thumbnail: string | undefined): ReactElement {
  return (thumbnail && TYPE_GLYPHS[thumbnail]) || GENERIC_GLYPH;
}

/** Every key an editor can choose in the type-builder. */
export const TYPE_GLYPH_KEYS: string[] = Object.keys(TYPE_GLYPHS);

/**
 * The type-builder's thumbnail control: a plain `<select>` of glyph keys with the
 * chosen glyph rendered beside it. A `<select>` rather than a grid of clickable
 * previews because this sits in a dense Type-meta row, and a native select is
 * keyboard- and screen-reader-correct for free.
 */
export function TypeGlyphSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <FieldShell label="Thumbnail">
      <div className="flex items-center gap-2">
        <span className="h-10 w-16 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 p-1 text-neutral-400">
          {typeGlyph(value)}
        </span>
        <Select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          aria-label="Thumbnail glyph"
        >
          <option value="">— none —</option>
          {TYPE_GLYPH_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
      </div>
    </FieldShell>
  );
}
