// Shared presentation helpers for the edit drawer (plain module — safe to import
// from client leaves; no "use client" needed).

export type FormValues = Record<string, unknown>;

export const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-subtle outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60";

export const FIELD_LABEL_CLASS =
  "mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground";

export const FIELD_TYPE_BADGE_CLASS =
  "rounded bg-surface px-1.5 py-0.5 text-[11px] font-normal uppercase tracking-wide text-subtle";

export function humanizeFieldName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}
