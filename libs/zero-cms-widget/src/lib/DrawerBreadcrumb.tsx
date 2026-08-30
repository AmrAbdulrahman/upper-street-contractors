'use client';

/**
 * The trail across a stack of Edit drawers — one line per open panel, every
 * ancestor a jump back to it.
 *
 * Panels fully overlap (they are all the same width and the scrim is drawn only
 * by the top one), so before this there was no way to tell four levels deep from
 * one, and no way out but pressing Escape once per level. Each crumb names its
 * panel twice over: the Type it is editing, and — once the editor has loaded the
 * entry and reported it back — that entry's own title, which is what tells two
 * sibling Questions apart.
 *
 * Rendered by the drawer host above the panel body rather than inside
 * `EntryEditor`: the editor is shared with the Content admin, which has no stack
 * and nothing to render here.
 *
 * Laid out as one crumb per line with a hanging indent rather than a wrapping
 * inline row — a 30rem panel cannot fit four `Type · Title` pairs across, and a
 * trail that reflows as titles load is worse than no trail.
 */

import type { Schema } from '@usc/zero-cms-core';

/** The subset of a drawer frame this needs; keeps `DrawerTarget` unexported. */
export interface BreadcrumbFrame {
  key: string;
  type: string | null;
  mode: 'edit' | 'create' | 'pick-type' | 'pick-template';
  title?: string | null;
  loading?: boolean;
  /** pick-type panels: the field being added to, already humanized. */
  fieldLabel?: string;
}

function typeLabel(schema: Schema, name: string | null): string | null {
  if (!name) return null;
  return schema.find((t) => t.__name === name)?.label ?? name;
}

/** What one crumb says, by panel mode. */
export function crumbText(schema: Schema, frame: BreadcrumbFrame): string {
  if (frame.mode === 'pick-template') return 'Choose a template';
  if (frame.mode === 'pick-type')
    return `Add ${frame.fieldLabel ? frame.fieldLabel.toLowerCase() : 'section'}`;

  const label = typeLabel(schema, frame.type);
  if (!label) return frame.loading ? 'Loading…' : 'Entry';
  if (frame.mode === 'create') return `New ${label}`;
  return frame.title ? `${label} · ${frame.title}` : label;
}

/**
 * The nesting mark between a crumb and its parent — a corner-down-right, not a
 * chevron. The trail is one crumb PER LINE with a growing indent, so the arrow
 * a reader needs is the one that turns: `›` pointed along a row that isn't
 * there, while this drops out of the line above and then across into this one,
 * which is the shape the indent is already drawing.
 */
function CornerDownRightIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0 text-neutral-300"
    >
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}

export function DrawerBreadcrumb({
  schema,
  stack,
  activeIndex,
  onJump,
}: {
  schema: Schema;
  stack: readonly BreadcrumbFrame[];
  /** Which panel this trail is being rendered inside. */
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  // Only the panels at or below this one are on the way here; anything above is
  // a panel this one cannot see, and a crumb for it would be a forward jump.
  const trail = stack.slice(0, activeIndex + 1);
  if (!trail.length) return null;

  return (
    <nav aria-label="Editing path" className="mb-3">
      <ol className="space-y-0.5 text-xs">
        {trail.map((frame, i) => {
          const isCurrent = i === trail.length - 1;
          const text = crumbText(schema, frame);
          return (
            <li
              key={frame.key}
              className="flex min-w-0 items-center gap-1"
              style={{ paddingLeft: i === 0 ? 0 : `${(i - 1) * 0.5 + 0.5}rem` }}
            >
              {i > 0 && <CornerDownRightIcon />}
              {isCurrent ? (
                <span
                  aria-current="true"
                  className="min-w-0 truncate font-medium text-neutral-700"
                  title={text}
                >
                  {text}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  title={text}
                  className="min-w-0 truncate rounded px-1 py-0.5 text-neutral-500 underline-offset-2 transition-colors hover:bg-neutral-100 hover:text-neutral-900 hover:underline focus-visible:bg-neutral-100 focus-visible:text-neutral-900"
                >
                  {text}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
