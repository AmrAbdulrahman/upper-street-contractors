export type SupportedKind =
  | "text"
  | "richtext"
  | "number"
  | "boolean"
  | "enumeration"
  | "json"
  | "media"
  | "relation"
  | "unsupported";

export type RelationCardinality =
  | "oneToOne"
  | "oneToMany"
  | "manyToOne"
  | "manyToMany";

export type SchemaFieldDescriptor = {
  name: string;
  /** Raw Strapi attribute type, e.g. "string", "blocks", "integer", "relation". */
  strapiType: string;
  supportedKind: SupportedKind;
  /** Allowed values for `enumeration` fields (from `attr.enum`). */
  enumOptions?: string[];
  /** Keys to seed for an empty (null) flat-object `json` field, e.g. lat/lon. */
  jsonKeys?: string[];
  /** `media` only: whether the field accepts multiple files (from `attr.multiple`). */
  mediaMultiple?: boolean;
  /** `media` only: allowed upload kinds, e.g. ["images"] (from `attr.allowedTypes`). */
  mediaAllowedTypes?: string[];
  /** `relation` only: cardinality (from `attr.relation`). */
  relationCardinality?: RelationCardinality;
  /** `relation` only: target content-type singular, e.g. "button". */
  relationTargetSingular?: string;
};

/** Minimal shape of a Strapi media file used by the media field + picker. */
export type MediaFileRef = {
  id: number;
  name: string;
  /** Strapi-relative URL, e.g. "/uploads/foo.jpg". */
  url: string;
  mime?: string;
};

/** A related entry reduced to its documentId + a display label. */
export type RelationRef = {
  documentId: string;
  label: string;
};

export type SchemaDescriptor = {
  /** Folder/slug, e.g. "home-header-section". */
  singular: string;
  singularName: string;
  pluralName: string;
  kind: "collectionType" | "singleType";
  fields: SchemaFieldDescriptor[];
};

export type EntryFieldDescriptor = SchemaFieldDescriptor & {
  value: unknown;
  /** Deep link to this field in the Strapi admin (fallback for unsupported types). */
  cmsUrl: string;
};

export type EntryFormDescriptor = {
  available: boolean;
  typename: string | null;
  singular: string | null;
  kind: "collectionType" | "singleType" | null;
  documentId: string | null;
  focusedField: string | null;
  entryCmsUrl: string;
  fields: EntryFieldDescriptor[];
};

export type UpdateResult = { ok: true } | { ok: false; error: string };

export type PublishTarget = {
  documentId: string;
  typename: string | null;
};

export type PublishResult = {
  ok: boolean;
  published: PublishTarget[];
  errors: (PublishTarget & { error: string })[];
};
