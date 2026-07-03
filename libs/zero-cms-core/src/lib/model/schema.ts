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
  | 'blocks'
  | 'number'
  | 'json'
  | 'boolean'
  | 'asset'
  | 'lookup'
  | 'reference'
  | 'references';

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
}

export interface TextField extends FieldMetaBase {
  __name: string;
  /** `richtext` holds an HTML/markdown string; use `blocks` for structured content. */
  __type: 'text' | 'longtext' | 'richtext';
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
}

export type Field =
  | TextField
  | BlocksField
  | NumberField
  | JsonField
  | BooleanField
  | AssetField
  | LookupField
  | ReferenceField
  | ReferencesField;

export interface Type {
  /** Unique across all Types. Drives generated type + store names. */
  __name: string;
  /** Human label for the app UI. Defaults to `__name`. */
  label?: string;
  fields: Field[];
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
