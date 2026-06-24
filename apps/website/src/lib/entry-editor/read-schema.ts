import fs from "node:fs";
import path from "node:path";
import { targetUidToSingular } from "./relation-label";
import type {
  SchemaDescriptor,
  SchemaFieldDescriptor,
  SupportedKind,
} from "./types";

// Seed keys for known empty (null) flat-object `json` fields so the user gets
// labelled inputs instead of a blank form. Values present in the entry override
// these (keys are read from the value itself).
const JSON_FIELD_SEED_KEYS: Record<string, string[]> = {
  mapLocation: ["lat", "lon"],
};

// System/managed attributes never edited through the drawer.
const SYSTEM_FIELDS = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "locale",
  "createdBy",
  "updatedBy",
  "localizations",
]);

function classify(strapiType: string): SupportedKind {
  switch (strapiType) {
    case "string":
    case "text":
      return "text";
    case "blocks":
      return "richtext";
    case "integer":
    case "biginteger":
    case "decimal":
    case "float":
      return "number";
    case "boolean":
      return "boolean";
    case "enumeration":
      return "enumeration";
    case "json":
      return "json";
    case "media":
      return "media";
    case "relation":
      return "relation";
    default:
      return "unsupported";
  }
}

// Schemas are static per deploy → cache indefinitely. `null` is cached too so a
// missing schema (e.g. prod without apps/cms) isn't re-resolved on every call.
const cache = new Map<string, SchemaDescriptor | null>();

function resolveApiRoot(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "../cms/src/api"),
    path.resolve(process.cwd(), "apps/cms/src/api"),
    path.resolve(process.cwd(), "src/api"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function isDraftPublishable(singular: string): boolean {
  const schemaPath = resolveSchemaPath(singular);
  if (!schemaPath) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as {
      options?: { draftAndPublish?: boolean };
    };
    return raw.options?.draftAndPublish === true;
  } catch {
    return false;
  }
}

/** Content types with draft & publish enabled (for listing unpublished drafts). */
export function listDraftPublishableSchemas(): SchemaDescriptor[] {
  const apiRoot = resolveApiRoot();
  if (!apiRoot) return [];

  return fs
    .readdirSync(apiRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "inspect")
    .map((entry) => readSchemaDescriptor(entry.name))
    .filter(
      (schema): schema is SchemaDescriptor =>
        schema !== null && isDraftPublishable(schema.singular),
    );
}
function resolveSchemaPath(singular: string): string | null {
  const rel = path.join(
    "api",
    singular,
    "content-types",
    singular,
    "schema.json",
  );
  // Mirror the multi-candidate resolution in lib/strapi-auth.ts (cwd may be the
  // website app dir or the repo root depending on how the server was launched).
  const candidates = [
    path.resolve(process.cwd(), "../cms/src", rel),
    path.resolve(process.cwd(), "apps/cms/src", rel),
    path.resolve(process.cwd(), "src", rel),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function readSchemaDescriptor(singular: string): SchemaDescriptor | null {
  if (cache.has(singular)) {
    return cache.get(singular) ?? null;
  }

  const schemaPath = resolveSchemaPath(singular);
  if (!schemaPath) {
    cache.set(singular, null);
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as {
      kind?: string;
      info?: { singularName?: string; pluralName?: string };
      attributes?: Record<
        string,
        {
          type?: string;
          enum?: string[];
          multiple?: boolean;
          allowedTypes?: string[];
          relation?: string;
          target?: string;
        }
      >;
    };

    const attributes = raw.attributes ?? {};
    const fields: SchemaFieldDescriptor[] = Object.entries(attributes)
      .filter(([name]) => !SYSTEM_FIELDS.has(name))
      .map(([name, attr]) => {
        const strapiType = attr?.type ?? "unknown";
        const supportedKind = classify(strapiType);
        return {
          name,
          strapiType,
          supportedKind,
          ...(supportedKind === "enumeration" && Array.isArray(attr?.enum)
            ? { enumOptions: attr.enum }
            : {}),
          ...(supportedKind === "json" && JSON_FIELD_SEED_KEYS[name]
            ? { jsonKeys: JSON_FIELD_SEED_KEYS[name] }
            : {}),
          ...(supportedKind === "media"
            ? {
                mediaMultiple: Boolean(attr?.multiple),
                ...(Array.isArray(attr?.allowedTypes)
                  ? { mediaAllowedTypes: attr.allowedTypes }
                  : {}),
              }
            : {}),
          ...(supportedKind === "relation"
            ? {
                ...(attr?.relation
                  ? { relationCardinality: attr.relation as never }
                  : {}),
                ...(targetUidToSingular(attr?.target)
                  ? {
                      relationTargetSingular: targetUidToSingular(
                        attr?.target,
                      ) as string,
                    }
                  : {}),
              }
            : {}),
        };
      });

    const descriptor: SchemaDescriptor = {
      singular,
      singularName: raw.info?.singularName ?? singular,
      pluralName: raw.info?.pluralName ?? singular,
      kind: raw.kind === "singleType" ? "singleType" : "collectionType",
      fields,
    };

    cache.set(singular, descriptor);
    return descriptor;
  } catch {
    cache.set(singular, null);
    return null;
  }
}
