/**
 * Entry title — the one derivation of what an Entry is called, wherever an
 * editor reads one: the Content admin's list, every reference and Type picker,
 * the Section builder's drag cards, the Drawer breadcrumb, the
 * reference-integrity refusal.
 *
 * Two inputs, in precedence order:
 * 1. `Entry.__title` — the Title override an editor typed in the Content admin.
 * 2. `Type.titleField` — the Title field, whose value is *derived* into a title
 *    by the rules below. Absent (or dangling) falls back to the Type's first
 *    `text`/`longtext` field, which is the rule this file replaced.
 *
 * Nothing resolves → `Untitled <Type label>`. A title exists to tell two
 * siblings apart, so "Untitled" is deliberate: it says the entry needs copy,
 * which a bare Type label does not.
 *
 * Pure and synchronous — no `DOMParser` (this runs in Node for the migration
 * script and the specs) and no I/O. An `asset` title needs the media library,
 * which every caller already holds, so it is passed in rather than fetched.
 */

import type {
  BlocksContent,
  BlocksNode,
  Field,
  FieldType,
  Type,
} from './schema';
import { isReferenceField } from './schema';
import type { MediaItem } from './media';

/** Words kept from a rich-text field. Enough to tell two passages apart. */
const RICHTEXT_WORDS = 3;

/** Characters kept from a plain-value field, before an ellipsis. */
const MAX_LENGTH = 40;

/** Kinds the implicit fallback picks, in order, when no Title field is set. */
const IMPLICIT_KINDS: readonly FieldType[] = ['text', 'longtext'];

export function truncate(s: string, max = MAX_LENGTH): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/** First `n` whitespace-separated words, with an ellipsis when more follow. */
export function firstWords(s: string, n = RICHTEXT_WORDS): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const head = words.slice(0, n).join(' ');
  return words.length > n ? `${head}…` : head;
}

function flatten(node: BlocksNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.children ?? []).map(flatten).join('');
}

/**
 * One block node's text. A list's items are newline-separated so it does not
 * read as one run-on word. Exported because the blocks editor needs per-node.
 */
export function blockNodeText(node: BlocksNode): string {
  if (node.type === 'list')
    return (node.children ?? []).map(flatten).join('\n');
  return flatten(node);
}

/** Flatten a whole `blocks` tree to plain text. */
export function blocksToPlainText(content: BlocksContent | undefined): string {
  if (!Array.isArray(content)) return '';
  return content.map(blockNodeText).join('\n');
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

/**
 * Strip a `richtext` HTML/markdown string to plain text. Regex rather than
 * `DOMParser`, which exists only in a browser — `htmlToBlocks` is client-only
 * for that exact reason, and a title has to resolve in Node too.
 */
export function richtextToPlainText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** A field may be a Title field unless it holds Entry ids. */
export function isTitleFieldCandidate(field: Field): boolean {
  return !isReferenceField(field);
}

/**
 * The Field a Type's titles are derived from — its declared `titleField` when
 * that still names an eligible field, else the first `text`/`longtext`.
 *
 * A dangling or newly-relational `titleField` degrades to the implicit rule
 * rather than to nothing: renaming a field should not blank every title in the
 * CMS while an editor works out what happened.
 */
export function titleFieldOf(type: Type | undefined): Field | undefined {
  if (!type) return undefined;
  const declared = type.titleField
    ? type.fields.find((f) => f.__name === type.titleField)
    : undefined;
  if (declared && isTitleFieldCandidate(declared)) return declared;
  for (const kind of IMPLICIT_KINDS) {
    const found = type.fields.find((f) => f.__type === kind);
    if (found) return found;
  }
  return undefined;
}

function labelOf(type: Type | undefined): string {
  return type?.label ?? type?.__name ?? 'entry';
}

/** The media library, however the caller already holds it. */
export type MediaLookup = readonly MediaItem[] | ReadonlyMap<string, MediaItem>;

function mediaTitle(id: unknown, media: MediaLookup | undefined): string | null {
  if (typeof id !== 'string' || !id || !media) return null;
  const item = Array.isArray(media)
    ? media.find((m) => m.id === id)
    : (media as ReadonlyMap<string, MediaItem>).get(id);
  if (!item) return null;
  // Alt text is the only human-authored name a media item carries; `filename`
  // is the only one always present. `MediaItem` has no `title`.
  return item.alternativeText?.trim() || item.filename || null;
}

/**
 * Derive a title from one field's stored value. `null` means "this value names
 * nothing" — an unset field, or an `asset` whose media item is missing.
 */
function deriveTitle(
  field: Field,
  value: unknown,
  media: MediaLookup | undefined,
): string | null {
  if (value == null || value === '') return null;
  // Exhaustive over FieldType — a new kind is a compile error here, the same
  // guarantee `fieldRegistry` gets from its Record<FieldType, …>.
  switch (field.__type) {
    case 'text':
    case 'longtext':
    case 'slug':
    case 'user':
    case 'lookup':
    case 'date':
    case 'color':
      return typeof value === 'string' ? truncate(value.trim()) || null : null;
    case 'richtext':
      return typeof value === 'string'
        ? firstWords(richtextToPlainText(value)) || null
        : null;
    case 'blocks':
      return firstWords(blocksToPlainText(value as BlocksContent)) || null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : null;
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'asset':
      return mediaTitle(value, media);
    case 'json':
      return truncate(JSON.stringify(value)) || null;
    case 'reference':
    case 'references':
      // Never offered as a Title field — a relation holds ids, not a name.
      return null;
    default: {
      const exhaustive: never = field;
      void exhaustive;
      return null;
    }
  }
}

/**
 * The flat entry shape this reads. Structurally `OutputEntry`, declared loosely
 * so the model layer does not depend on the engine's output module.
 */
export interface TitleableEntry {
  __id: string;
  __title?: string | null;
  [field: string]: unknown;
}

/**
 * What the CMS calls this Entry. Never empty.
 *
 * `media` is consulted only for an `asset` Title field; omit it and such a Type
 * falls back to `Untitled <Type label>`.
 */
export function entryTitle(
  type: Type | undefined,
  entry: TitleableEntry,
  media?: MediaLookup,
): string {
  const override = entry.__title;
  if (typeof override === 'string' && override.trim()) return override.trim();

  const field = titleFieldOf(type);
  const derived = field ? deriveTitle(field, entry[field.__name], media) : null;
  return derived ?? `Untitled ${labelOf(type)}`;
}

/**
 * Whether `entryTitle` had nothing to work with. Lets a caller print the
 * entry's short id beside the fallback, which is then the only thing telling
 * two blank siblings apart.
 */
export function isUntitled(
  type: Type | undefined,
  entry: TitleableEntry,
  media?: MediaLookup,
): boolean {
  if (typeof entry.__title === 'string' && entry.__title.trim()) return false;
  const field = titleFieldOf(type);
  return !field || deriveTitle(field, entry[field.__name], media) === null;
}
