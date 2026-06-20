import fs from "node:fs";
import path from "node:path";
import type {
  SchemaDescriptor,
  SchemaFieldDescriptor,
  SupportedKind,
} from "./types";

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
    default:
      return "unsupported";
  }
}

// Schemas are static per deploy → cache indefinitely. `null` is cached too so a
// missing schema (e.g. prod without apps/cms) isn't re-resolved on every call.
const cache = new Map<string, SchemaDescriptor | null>();

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
      attributes?: Record<string, { type?: string }>;
    };

    const attributes = raw.attributes ?? {};
    const fields: SchemaFieldDescriptor[] = Object.entries(attributes)
      .filter(([name]) => !SYSTEM_FIELDS.has(name))
      .map(([name, attr]) => {
        const strapiType = attr?.type ?? "unknown";
        return { name, strapiType, supportedKind: classify(strapiType) };
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
