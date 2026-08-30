/**
 * Schema model — the shape stored in `types.json`.
 *
 * `types.json` is an array of {@link Type}. Each Type has a unique `__name`
 * (drives generated type + store names) and a set of {@link Field}s.
 */

export type FieldType =
  | 'text'
  | 'longtext'
  | 'richtext'
  | 'slug'
  | 'user'
  | 'blocks'
  | 'number'
  | 'json'
  | 'boolean'
  | 'date'
  | 'asset'
  | 'lookup'
  | 'color'
  | 'reference'
  | 'references';

/** The one shape a `color` value may take — `#rgb`, `#rrggbb` or `#rrggbbaa`. */
export const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** The one shape a `slug` value may take — lowercase words joined by hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Structured rich text — a portable, Strapi-blocks-compatible tree. Stored as the
 * value of a `blocks` field and rendered by `@usc/zero-cms-blocks`.
 */
export interface BlocksNode {
  type: string;
  children?: BlocksNode[];
  text?: string;
  [key: string]: unknown;
}
export type BlocksContent = BlocksNode[];

/** Arbitrary JSON value held by a `json` field. */
export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Common metadata carried by every field. */
export interface FieldMetaBase {
  /** Human label for the app UI. Defaults to `__name`. */
  label?: string;
  /** Whether a (published) value is required. */
  required?: boolean;
  /** Free-form description shown in the app. */
  description?: string;
  /**
   * Value injected for entries stored before this field existed (ADR 0011,
   * read-time projection) — and the value an eager backfill-on-save writes
   * into existing entries, if requested. `null` (not this field) when unset.
   */
  default?: unknown;
  /**
   * Optional section heading. A Type whose fields carry more than one distinct
   * `group` is rendered as a tab strip instead of one long form — the same
   * mechanism whatever the Type, so a 25-field settings singleton and a big
   * content Type both become navigable without a bespoke screen for either.
   *
   * Fields with no group sit in an untitled first tab; the tab order is the
   * order the groups first appear in `fields`.
   */
  group?: string;
}

export interface TextField extends FieldMetaBase {
  __name: string;
  /** `richtext` holds an HTML/markdown string; use `blocks` for structured content. */
  __type: 'text' | 'longtext' | 'richtext';
}

/**
 * A URL segment: lowercase words joined by hyphens ({@link SLUG_PATTERN}),
 * validated rather than merely suggested, because the value ends up in a live URL.
 *
 * Its own kind rather than `text` + a pattern because the *derivation* is the
 * point: the app's editor mirrors `from`'s value (slugified) until the field is
 * touched, then stops for good — so a title can be reworded without silently
 * moving a URL that has already been shared.
 */
export interface SlugField extends FieldMetaBase {
  __name: string;
  __type: 'slug';
  /** Field `__name` on the same Type to derive from while untouched (e.g. `title`). */
  from?: string;
}

/**
 * A person, stored as the display **name** of the CMS user chosen when the value
 * was set — not a user id. Users live outside the entry store (`users.json`), so
 * a live link would mean a public read path over accounts just to print a byline;
 * the name is the part that is actually published. See ADR 0016.
 */
export interface UserField extends FieldMetaBase {
  __name: string;
  __type: 'user';
}

/** Structured rich text ({@link BlocksContent}). */
export interface BlocksField extends FieldMetaBase {
  __name: string;
  __type: 'blocks';
}

/** Numeric value. */
export interface NumberField extends FieldMetaBase {
  __name: string;
  __type: 'number';
  /** Reject non-integers when true. */
  integer?: boolean;
  min?: number;
  max?: number;
}

/** Arbitrary JSON value ({@link JsonValue}). */
export interface JsonField extends FieldMetaBase {
  __name: string;
  __type: 'json';
}

export interface BooleanField extends FieldMetaBase {
  __name: string;
  __type: 'boolean';
}

/** Calendar date stored as an ISO 8601 string (`YYYY-MM-DD`). */
export interface DateField extends FieldMetaBase {
  __name: string;
  __type: 'date';
}

/** Points at a file in the media library. */
export interface AssetField extends FieldMetaBase {
  __name: string;
  __type: 'asset';
  /** Which media kinds are accepted. Default `any`. */
  accept?: 'image' | 'video' | 'any';
}

/** Text constrained to a predefined set of accepted values. */
export interface LookupField extends FieldMetaBase {
  __name: string;
  __type: 'lookup';
  options: string[];
}

/**
 * A colour, stored as a hex string ({@link COLOR_PATTERN}) and edited with a
 * native colour picker.
 *
 * Its own kind rather than a `text` field holding a hex string: the value has a
 * shape worth validating on write, and — more to the point — an editor asked to
 * type `#fcdd09` into a text box is being asked to do a job the platform has a
 * control for. The stored value stays a plain string, so it drops straight into
 * a style without a conversion step.
 *
 * Hex only, deliberately. `rgba()` / `hsl()` / named colours would each need
 * their own parse-and-validate path, and the picker cannot produce them.
 */
export interface ColorField extends FieldMetaBase {
  __name: string;
  __type: 'color';
  /** Swatches offered beside the picker, e.g. a brand palette. */
  presets?: string[];
}

/** Holds one entry id of an allowed target Type. */
export interface ReferenceField extends FieldMetaBase {
  __name: string;
  __type: 'reference';
  /** `__name`s of Types this reference may point at. */
  allowedTypes: string[];
}

/** Holds an array of entry ids; targets may mix allowed Types. */
export interface ReferencesField extends FieldMetaBase {
  __name: string;
  __type: 'references';
  allowedTypes: string[];
  /** Minimum linked entries; the references editor blocks removing below this. */
  min?: number;
  /** Maximum linked entries; "+ Add" is disabled at this count. */
  max?: number;
}

export type Field =
  | TextField
  | SlugField
  | UserField
  | BlocksField
  | NumberField
  | JsonField
  | BooleanField
  | DateField
  | AssetField
  | LookupField
  | ColorField
  | ReferenceField
  | ReferencesField;

export interface Type {
  /** Unique across all Types. Drives generated type + store names. */
  __name: string;
  /** Human label for the app UI. Defaults to `__name`. */
  label?: string;
  /**
   * One-line blurb describing what this Type is for, shown under its label
   * wherever a Type is *chosen* rather than an Entry — currently the Section
   * builder's Type picker ("Text content with formatting").
   */
  description?: string;
  /**
   * Key into the consumer's glyph registry (see `TYPE_GLYPHS` in
   * `@usc/zero-cms-widget`) giving this Type a wireframe thumbnail in the Type
   * picker. Deliberately a key, not a media id: a Type only becomes pickable
   * once a host app ships a component for it, so the glyph ships with that
   * component and can never dangle. Unknown/absent → the generic glyph.
   */
  thumbnail?: string;
  /**
   * Field `__name` whose value titles every Entry of this Type wherever an
   * editor reads one (see `entryTitle`). Any kind but a relation — a relation
   * holds ids, so naming an Entry by one would name it after another Entry.
   * Absent, or naming a field that has since been removed or turned into a
   * relation, falls back to the first `text`/`longtext` field.
   */
  titleField?: string;
  fields: Field[];
  /**
   * Stamped by `Engine.saveSchema`, matching Types by `__name` against the
   * previously stored schema — there's no other stable identity, so renaming
   * a Type is indistinguishable from replacing it and resets both. Absent on
   * Types saved before this was tracked (backfilled on their next save).
   */
  __createdAt?: string;
  /** Bumped whenever `label`/`fields` change; untouched on a no-op save. */
  __updatedAt?: string;
}

export type Schema = Type[];

/** Field kinds whose value(s) are entry ids. */
export const REFERENCE_KINDS: ReadonlySet<FieldType> = new Set([
  'reference',
  'references',
]);

export function isReferenceField(
  field: Field
): field is ReferenceField | ReferencesField {
  return field.__type === 'reference' || field.__type === 'references';
}
