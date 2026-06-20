export type SupportedKind =
  | "text"
  | "richtext"
  | "number"
  | "boolean"
  | "unsupported";

export type SchemaFieldDescriptor = {
  name: string;
  /** Raw Strapi attribute type, e.g. "string", "blocks", "integer", "relation". */
  strapiType: string;
  supportedKind: SupportedKind;
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
