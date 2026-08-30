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

/** One outlined five-point star, for the review and accreditation marks. */
function Star({ cx, cy, r = 2.6 }: { cx: number; cy: number; r?: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = (cx + radius * Math.cos(angle)).toFixed(1);
    const y = (cy + radius * Math.sin(angle)).toFixed(1);
    return x + ',' + y;
  });
  return <polygon points={points.join(' ')} strokeLinejoin="round" />;
}

/** A row of `n` stars — a review score, or the mark under a trust badge. */
function Stars({
  n,
  x,
  cy,
  gap = 7,
  r = 2.6,
}: {
  n: number;
  x: number;
  cy: number;
  gap?: number;
  r?: number;
}) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} cx={x + i * gap} cy={cy} r={r} />
      ))}
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

  /** Home Hero — a full banner with a title and the at-a-glance stat strip. */
  homeHero: (
    <Glyph>
      <rect x="6" y="5" width="52" height="30" rx="2" />
      <line x1="13" y1="13" x2="41" y2="13" />
      <line x1="13" y1="19" x2="31" y2="19" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={13 + i * 13} y="24" width="10" height="7" rx="1.5" />
      ))}
    </Glyph>
  ),

  /** Contact Details — a card of labelled ways to reach us, over a button. */
  contactCard: (
    <Glyph>
      <rect x="10" y="5" width="44" height="30" rx="2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="17" cy={11 + i * 6} r="1.8" />
          <line x1="22" y1={11 + i * 6} x2="47" y2={11 + i * 6} />
        </g>
      ))}
      <rect x="17" y="27" width="18" height="6" rx="3" fill="currentColor" stroke="none" />
    </Glyph>
  ),

  /** Who We Are — overline, copy and a button beside a photo. */
  whoWeAre: (
    <Glyph>
      <line x1="8" y1="7" x2="22" y2="7" />
      <Lines n={3} x={8} width={22} top={14} gap={5} />
      <rect x="8" y="29" width="14" height="5" rx="2.5" fill="currentColor" stroke="none" />
      <Frame x={36} y={11} w={20} h={22} />
    </Glyph>
  ),

  /** Service Offer — a numbered scope list beside a cost card. */
  serviceOffer: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="11" cy={12 + i * 9} r="3" />
          <line x1="18" y1={12 + i * 9} x2="38" y2={12 + i * 9} />
        </g>
      ))}
      <rect x="44" y="8" width="14" height="24" rx="2" />
      <line x1="47" y1="15" x2="55" y2="15" />
      <line x1="47" y1="20" x2="52" y2="20" />
      <rect x="47" y="24" width="8" height="4" rx="2" fill="currentColor" stroke="none" />
    </Glyph>
  ),

  /** Image with Text — a full-width overline above a photo and its copy. */
  splitImage: (
    <Glyph>
      <line x1="8" y1="7" x2="56" y2="7" />
      <Frame x={8} y={13} w={22} h={20} />
      <Lines n={4} x={36} width={20} top={15} gap={5} />
    </Glyph>
  ),

  /** Accreditations — trust shields over a review score. */
  accreditations: (
    <Glyph>
      {[14, 32, 50].map((cx) => (
        <path key={cx} d={`M${cx} 6 l7 2.5 v6 q0 6.5 -7 9.5 q-7 -3 -7 -9.5 v-6 z`} />
      ))}
      <Stars n={5} x={18} cy={32} />
    </Glyph>
  ),

  /** What We Do — service tiles with a price line, over a banner. */
  whatWeDo: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={7 + i * 17} y="6" width="14" height="17" rx="1.5" />
          <rect
            x={10 + i * 17}
            y="9"
            width="5"
            height="5"
            rx="1"
            fill="currentColor"
            stroke="none"
          />
          <line x1={10 + i * 17} y1="18" x2={18 + i * 17} y2="18" />
        </g>
      ))}
      <rect x="7" y="27" width="50" height="7" rx="2" strokeDasharray="3 3" />
    </Glyph>
  ),

  /** Why Choose Us — ticked reasons beside a portrait. */
  whyChooseUs: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path d={`M8 ${12 + i * 8} l2.5 2.5 l4.5 -5`} />
          <line x1="19" y1={13 + i * 8} x2="38" y2={13 + i * 8} />
        </g>
      ))}
      <rect x="43" y="8" width="15" height="24" rx="2" />
      <circle cx="50.5" cy="16" r="3" />
      <path d="M45.5 30 q5 -7 10 0" />
    </Glyph>
  ),

  /** How It Works — numbered steps joined in sequence. */
  howItWorks: (
    <Glyph>
      <line x1="20" y1="16" x2="26" y2="16" />
      <line x1="38" y1="16" x2="44" y2="16" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={14 + i * 18} cy="16" r="6" />
          <line x1={9 + i * 18} y1="29" x2={19 + i * 18} y2="29" />
        </g>
      ))}
    </Glyph>
  ),

  /** Recent Work — project photos, the first wearing its category tag. */
  recentWork: (
    <Glyph>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={7 + i * 17} y="8" width="14" height="14" rx="1.5" />
          <path d={`M${9 + i * 17} 20 l4 -5 l3 3 l2.5 -3`} />
          <line x1={7 + i * 17} y1="27" x2={19 + i * 17} y2="27" />
        </g>
      ))}
      <rect x="9" y="10" width="9" height="4" rx="2" fill="currentColor" stroke="none" />
    </Glyph>
  ),

  /** Case Studies — projects narrowed to one category. */
  caseStudies: (
    <Glyph>
      <rect x="8" y="5" width="15" height="5" rx="2.5" fill="currentColor" stroke="none" />
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={8 + i * 26} y="14" width="22" height="14" rx="2" />
          <path d={`M${11 + i * 26} 26 l6 -7 l4 4 l3.5 -4`} />
          <line x1={8 + i * 26} y1="33" x2={26 + i * 26} y2="33" />
        </g>
      ))}
    </Glyph>
  ),

  /** Service Grid — a 2x2 grid of service cards. */
  serviceGrid: (
    <Glyph>
      {[0, 1].map((c) =>
        [0, 1].map((r) => (
          <g key={`${c}-${r}`}>
            <rect x={11 + c * 23} y={4 + r * 17} width="19" height="10" rx="1.5" />
            <line x1={11 + c * 23} y1={17 + r * 17} x2={25 + c * 23} y2={17 + r * 17} />
          </g>
        ))
      )}
    </Glyph>
  ),

  /** Client Reviews — a scored testimonial with its reviewer. */
  reviews: (
    <Glyph>
      <rect x="8" y="5" width="48" height="30" rx="2" />
      <Stars n={5} x={15} cy={12} />
      <line x1="15" y1="20" x2="49" y2="20" />
      <line x1="15" y1="24" x2="39" y2="24" />
      <circle cx="18" cy="30" r="2.5" />
      <line x1="24" y1="30" x2="37" y2="30" />
    </Glyph>
  ),

  /** Google Reviews — the G mark over a score. */
  googleReviews: (
    <Glyph>
      <path d="M37 7 A10 10 0 1 0 40 14 h-8" />
      <Stars n={5} x={18} cy={31} />
    </Glyph>
  ),

  /** Image Question — a wizard step answered by picking a card. */
  imageQuestion: (
    <Glyph>
      <line x1="8" y1="7" x2="34" y2="7" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={7 + i * 17} y="13" width="14" height="14" rx="2" />
          <path d={`M${9 + i * 17} 25 l4 -5 l3 3 l2.5 -3`} />
        </g>
      ))}
      <circle cx="21" cy="13" r="3.5" />
      <path d="M19.3 13 l1.2 1.2 l2.3 -2.5" />
    </Glyph>
  ),

  /** Form Question — a wizard step answered by typing. */
  formQuestion: (
    <Glyph>
      <line x1="8" y1="6" x2="40" y2="6" />
      <line x1="8" y1="10" x2="28" y2="10" />
      {[0, 1].map((i) => (
        <g key={i}>
          <line x1="8" y1={17 + i * 11} x2="20" y2={17 + i * 11} />
          <rect x="8" y={20 + i * 11} width="48" height="7" rx="1.5" />
        </g>
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
