"use server";

import { isStrapiInspectionBuildEnabled } from "@/components/metadata";
import {
  buildStrapiEntryUrl,
  graphqlTypenameToStrapiSingular,
} from "@/helpers/strapi-entry-url";
import { getStrapiAuthHeaders, getStrapiUrl } from "@/lib/strapi-auth";
import { readSchemaDescriptor } from "./read-schema";
import type {
  EntryFieldDescriptor,
  EntryFormDescriptor,
  PublishResult,
  PublishTarget,
  UpdateResult,
} from "./types";

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

  let data: Record<string, unknown> = {};
  try {
    const res = await fetch(
      restEntryUrl(schema.kind, schema.singularName, schema.pluralName, documentId),
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

  const fields: EntryFieldDescriptor[] = schema.fields.map((field) => ({
    ...field,
    value: data?.[field.name] ?? null,
    cmsUrl: cmsUrl(typename, resolvedDocumentId, field.name),
  }));

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
