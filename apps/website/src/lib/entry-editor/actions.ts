"use server";

import { isStrapiInspectionBuildEnabled } from "@/components/metadata";
import {
  buildStrapiEntryUrl,
  graphqlTypenameToStrapiSingular,
} from "@/helpers/strapi-entry-url";
import { getStrapiAuthHeaders, getStrapiUrl } from "@/lib/strapi-auth";
import { readSchemaDescriptor } from "./read-schema";
import { pickEntryLabel } from "./relation-label";
import type {
  EntryFieldDescriptor,
  EntryFormDescriptor,
  MediaFileRef,
  RelationRef,
  PublishResult,
  PublishTarget,
  UpdateResult,
} from "./types";

function isMultiRelation(cardinality: string | undefined): boolean {
  return cardinality === "oneToMany" || cardinality === "manyToMany";
}

// Public (browser-clickable) admin URL — defaults to NEXT_PUBLIC_STRAPI_URL.
function cmsUrl(
  typename: string | null,
  documentId: string | null,
  focusedField?: string,
): string {
  return buildStrapiEntryUrl({
    documentId: documentId ?? "",
    typename,
    focusedField,
  });
}

function unavailableDescriptor(
  typename: string | null,
  documentId: string | null,
  focusedField: string | null,
): EntryFormDescriptor {
  return {
    available: false,
    typename,
    singular: null,
    kind: null,
    documentId,
    focusedField,
    entryCmsUrl: cmsUrl(typename, documentId),
    fields: [],
  };
}

async function extractStrapiError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return json?.error?.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

function restEntryUrl(
  kind: "collectionType" | "singleType",
  singularName: string,
  pluralName: string,
  documentId: string | null,
): string {
  const baseUrl = getStrapiUrl().replace(/\/$/, "");
  return kind === "singleType"
    ? `${baseUrl}/api/${singularName}?status=draft`
    : `${baseUrl}/api/${pluralName}/${documentId}?status=draft`;
}

export async function getEntryFormDescriptor(args: {
  typename: string | null;
  documentId: string | null;
  focusedField?: string | null;
}): Promise<EntryFormDescriptor> {
  const { typename, documentId } = args;
  const focusedField = args.focusedField ?? null;

  if (!isStrapiInspectionBuildEnabled()) {
    return unavailableDescriptor(typename, documentId, focusedField);
  }

  const singular = graphqlTypenameToStrapiSingular(typename);
  if (!singular) return unavailableDescriptor(typename, documentId, focusedField);

  const schema = readSchemaDescriptor(singular);
  if (!schema) return unavailableDescriptor(typename, documentId, focusedField);

  let headers: Record<string, string>;
  try {
    headers = getStrapiAuthHeaders();
  } catch {
    return unavailableDescriptor(typename, documentId, focusedField);
  }

  // Media + relations come back empty without populate. Populate those fields by
  // name (not populate=*) to keep the payload focused.
  const populateFields = schema.fields.filter(
    (field) =>
      field.supportedKind === "media" || field.supportedKind === "relation",
  );
  const populateQuery = populateFields
    .map((field) => `&populate[${field.name}]=true`)
    .join("");

  let data: Record<string, unknown> = {};
  try {
    const res = await fetch(
      restEntryUrl(schema.kind, schema.singularName, schema.pluralName, documentId) +
        populateQuery,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      return unavailableDescriptor(typename, documentId, focusedField);
    }
    const json = (await res.json()) as { data?: Record<string, unknown> | null };
    data = json?.data ?? {};
  } catch {
    return unavailableDescriptor(typename, documentId, focusedField);
  }

  // Single types don't carry a documentId in the page payload — take it from the
  // fetched entry so saves/publishes target the right document.
  const resolvedDocumentId =
    (typeof data?.documentId === "string" ? data.documentId : null) ?? documentId;

  const toRelationRef = (
    entry: unknown,
    singular: string,
  ): RelationRef | null => {
    if (!entry || typeof entry !== "object") return null;
    const record = entry as Record<string, unknown>;
    const documentId = typeof record.documentId === "string" ? record.documentId : "";
    if (!documentId) return null;
    return { documentId, label: pickEntryLabel(record, singular) };
  };

  const fields: EntryFieldDescriptor[] = schema.fields.map((field) => {
    let value: unknown = data?.[field.name] ?? null;

    if (field.supportedKind === "relation" && field.relationTargetSingular) {
      const singular = field.relationTargetSingular;
      if (isMultiRelation(field.relationCardinality)) {
        value = Array.isArray(value)
          ? value
              .map((entry) => toRelationRef(entry, singular))
              .filter((ref): ref is RelationRef => ref !== null)
          : [];
      } else {
        value = toRelationRef(value, singular);
      }
    }

    return {
      ...field,
      value,
      cmsUrl: cmsUrl(typename, resolvedDocumentId, field.name),
    };
  });

  return {
    available: true,
    typename,
    singular,
    kind: schema.kind,
    documentId: resolvedDocumentId,
    focusedField,
    entryCmsUrl: cmsUrl(typename, resolvedDocumentId),
    fields,
  };
}

export async function listMediaFiles(
  search?: string,
): Promise<MediaFileRef[]> {
  if (!isStrapiInspectionBuildEnabled()) return [];

  let headers: Record<string, string>;
  try {
    headers = getStrapiAuthHeaders();
  } catch {
    return [];
  }

  const baseUrl = getStrapiUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    sort: "createdAt:desc",
    "pagination[pageSize]": "100",
  });
  if (search?.trim()) {
    params.set("filters[name][$containsi]", search.trim());
  }

  try {
    const res = await fetch(`${baseUrl}/api/upload/files?${params.toString()}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return [];
    // The upload plugin returns a bare array, not the `{ data }` envelope.
    const files = (await res.json()) as Array<{
      id: number;
      name: string;
      url: string;
      mime?: string;
    }>;
    if (!Array.isArray(files)) return [];
    return files.map((file) => ({
      id: file.id,
      name: file.name,
      url: file.url,
      mime: file.mime,
    }));
  } catch {
    return [];
  }
}

export async function listEntries(
  targetSingular: string,
): Promise<RelationRef[]> {
  if (!isStrapiInspectionBuildEnabled()) return [];

  const schema = readSchemaDescriptor(targetSingular);
  if (!schema) return [];

  let headers: Record<string, string>;
  try {
    headers = getStrapiAuthHeaders();
  } catch {
    return [];
  }

  const baseUrl = getStrapiUrl().replace(/\/$/, "");
  const path =
    schema.kind === "singleType"
      ? `/api/${schema.singularName}`
      : `/api/${schema.pluralName}`;

  try {
    const res = await fetch(
      `${baseUrl}${path}?status=draft&pagination[pageSize]=200&sort=updatedAt:desc`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Record<string, unknown> | Record<string, unknown>[] | null;
    };
    const data = json?.data;
    const list = Array.isArray(data) ? data : data ? [data] : [];
    return list
      .map((entry) => ({
        documentId:
          typeof entry.documentId === "string" ? entry.documentId : "",
        label: pickEntryLabel(entry, targetSingular),
      }))
      .filter((ref) => ref.documentId);
  } catch {
    return [];
  }
}

export async function updateEntryFields(args: {
  typename: string | null;
  documentId: string | null;
  changes: Record<string, unknown>;
}): Promise<UpdateResult> {
  if (!isStrapiInspectionBuildEnabled()) {
    return { ok: false, error: "Inspection mode is not enabled." };
  }

  const { typename, documentId, changes } = args;
  const singular = graphqlTypenameToStrapiSingular(typename);
  if (!singular) return { ok: false, error: `Unknown content type: ${typename}` };

  const schema = readSchemaDescriptor(singular);
  if (!schema) return { ok: false, error: `Schema not found for "${singular}"` };

  let headers: Record<string, string>;
  try {
    headers = getStrapiAuthHeaders();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Auth failed" };
  }

  try {
    const res = await fetch(
      restEntryUrl(schema.kind, schema.singularName, schema.pluralName, documentId),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        cache: "no-store",
        body: JSON.stringify({ data: changes }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: await extractStrapiError(res) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

export async function publishEntries(
  targets: PublishTarget[],
): Promise<PublishResult> {
  const failAll = (message: string): PublishResult => ({
    ok: false,
    published: [],
    errors: targets.map((target) => ({ ...target, error: message })),
  });

  if (!isStrapiInspectionBuildEnabled()) {
    return failAll("Inspection mode is not enabled.");
  }

  let headers: Record<string, string>;
  try {
    headers = getStrapiAuthHeaders();
  } catch (error) {
    return failAll(error instanceof Error ? error.message : "Auth failed");
  }

  const errors: (PublishTarget & { error: string })[] = [];
  const resolved: { target: PublishTarget; uid: string }[] = [];
  for (const target of targets) {
    const singular = graphqlTypenameToStrapiSingular(target.typename);
    if (!singular || !target.documentId) {
      errors.push({ ...target, error: `Cannot resolve content type for ${target.typename}` });
      continue;
    }
    resolved.push({ target, uid: `api::${singular}.${singular}` });
  }

  if (resolved.length === 0) {
    return { ok: errors.length === 0, published: [], errors };
  }

  const baseUrl = getStrapiUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/inspect/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      cache: "no-store",
      body: JSON.stringify({
        entries: resolved.map((item) => ({
          uid: item.uid,
          documentId: item.target.documentId,
        })),
      }),
    });

    if (!res.ok) {
      const message = await extractStrapiError(res);
      return {
        ok: false,
        published: [],
        errors: [...errors, ...resolved.map((item) => ({ ...item.target, error: message }))],
      };
    }

    const json = (await res.json()) as {
      published?: { documentId: string }[];
      errors?: { documentId: string; error: string }[];
    };
    const publishedIds = new Set((json.published ?? []).map((item) => item.documentId));
    const errorById = new Map(
      (json.errors ?? []).map((item) => [item.documentId, item.error] as const),
    );

    const published: PublishTarget[] = [];
    for (const item of resolved) {
      const id = item.target.documentId;
      if (errorById.has(id)) {
        errors.push({ ...item.target, error: errorById.get(id) ?? "Publish failed" });
      } else if (publishedIds.has(id) || publishedIds.size === 0) {
        // The controller may not echo ids back; absence of an error means success.
        published.push(item.target);
      } else {
        published.push(item.target);
      }
    }

    return { ok: errors.length === 0, published, errors };
  } catch (error) {
    return {
      ok: false,
      published: [],
      errors: [
        ...errors,
        ...resolved.map((item) => ({
          ...item.target,
          error: error instanceof Error ? error.message : "Request failed",
        })),
      ],
    };
  }
}
