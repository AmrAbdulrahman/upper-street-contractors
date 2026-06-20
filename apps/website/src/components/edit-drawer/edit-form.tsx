"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { blocksToHtml, htmlToBlocks } from "@/lib/entry-editor/blocks-html";
import { updateEntryFields } from "@/lib/entry-editor/actions";
import type {
  EntryFieldDescriptor,
  EntryFormDescriptor,
} from "@/lib/entry-editor/types";
import { recordChangedEntry } from "./changed-entries-store";
import { BooleanField } from "./fields/boolean-field";
import { FieldRow } from "./fields/field-row";
import { NumberField } from "./fields/number-field";
import { TextField } from "./fields/text-field";
import { UnsupportedField } from "./fields/unsupported-field";
import { humanizeFieldName, type FormValues } from "./ui";

// HugeRTE is heavy — load it only when a richtext field is rendered.
const RichTextField = dynamic(() => import("./fields/rich-text-field"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-surface" />,
});

// Richtext is compared by its converted blocks (normalised through the same
// round-trip), so HugeRTE re-normalising the seeded HTML on init doesn't read
// as an edit. Text/number/boolean compare directly.
function fieldChanged(
  field: EntryFieldDescriptor,
  current: unknown,
  defaultValue: unknown,
): boolean {
  switch (field.supportedKind) {
    case "richtext":
      return (
        JSON.stringify(htmlToBlocks(String(current ?? "")).blocks) !==
        JSON.stringify(htmlToBlocks(String(defaultValue ?? "")).blocks)
      );
    case "number":
      return String(current ?? "") !== String(defaultValue ?? "");
    case "boolean":
      return Boolean(current) !== Boolean(defaultValue);
    case "text":
      return (current ?? "") !== (defaultValue ?? "");
    default:
      return false;
  }
}

export function EditForm({
  descriptor,
  onClose,
}: {
  descriptor: EntryFormDescriptor;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultValues = useMemo<FormValues>(() => {
    const values: FormValues = {};
    for (const field of descriptor.fields) {
      switch (field.supportedKind) {
        case "richtext":
          values[field.name] = blocksToHtml(field.value);
          break;
        case "boolean":
          values[field.name] = Boolean(field.value);
          break;
        case "number":
          values[field.name] = field.value == null ? "" : String(field.value);
          break;
        case "text":
          values[field.name] = (field.value as string) ?? "";
          break;
        default:
          break;
      }
    }
    return values;
  }, [descriptor]);

  const { control, handleSubmit } = useForm<FormValues>({ defaultValues });
  const watched = useWatch({ control });

  const isDirty = descriptor.fields.some(
    (field) =>
      field.supportedKind !== "unsupported" &&
      fieldChanged(field, watched?.[field.name], defaultValues[field.name]),
  );

  // Block Save when an *edited* richtext field still contains content the
  // converter can't represent (e.g. a pasted image/table) — saving would
  // silently strip it. Untouched fields aren't written, so they never block.
  const richtextIssues = descriptor.fields
    .filter(
      (field) =>
        field.supportedKind === "richtext" &&
        fieldChanged(field, watched?.[field.name], defaultValues[field.name]),
    )
    .map((field) => ({
      name: field.name,
      dropped: [
        ...new Set(htmlToBlocks(String(watched?.[field.name] ?? "")).dropped),
      ],
    }))
    .filter((issue) => issue.dropped.length > 0);

  const blockSave = richtextIssues.length > 0;

  const onSubmit = handleSubmit((values) => {
    // A disabled submit button still allows Enter-to-submit in some browsers.
    if (blockSave) return;

    const changes: Record<string, unknown> = {};
    const invalid: string[] = [];

    for (const field of descriptor.fields) {
      if (field.supportedKind === "unsupported") continue;
      if (!fieldChanged(field, values[field.name], defaultValues[field.name])) {
        continue;
      }
      const raw = values[field.name];

      if (field.supportedKind === "richtext") {
        changes[field.name] = htmlToBlocks(String(raw ?? "")).blocks;
      } else if (field.supportedKind === "number") {
        if (raw === "" || raw == null) {
          changes[field.name] = null;
        } else if (field.strapiType === "biginteger") {
          const parsed = z.string().regex(/^-?\d+$/).safeParse(String(raw));
          if (!parsed.success) invalid.push(field.name);
          else changes[field.name] = String(raw);
        } else {
          const parsed = z.coerce.number().finite().safeParse(raw);
          if (!parsed.success) invalid.push(field.name);
          else changes[field.name] = parsed.data;
        }
      } else if (field.supportedKind === "boolean") {
        changes[field.name] = Boolean(raw);
      } else {
        changes[field.name] = (raw as string) ?? "";
      }
    }

    if (invalid.length) {
      const message = `Enter a valid number for: ${invalid.join(", ")}`;
      setError(message);
      toast.error(message);
      return;
    }

    if (Object.keys(changes).length === 0) return;
    setError(null);

    startTransition(async () => {
      const result = await updateEntryFields({
        typename: descriptor.typename,
        documentId: descriptor.documentId,
        changes,
      });

      if (result.ok) {
        if (descriptor.documentId) {
          recordChangedEntry({
            typename: descriptor.typename,
            documentId: descriptor.documentId,
          });
        }
        toast.success("Draft saved");
        router.refresh();
        onClose();
      } else {
        const message = "error" in result ? result.error : "Save failed";
        setError(message);
        toast.error(message);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {descriptor.fields.map((field) => {
          const focused = field.name === descriptor.focusedField;
          return (
            <FieldRow
              key={field.name}
              name={field.name}
              strapiType={field.strapiType}
              focused={focused}
            >
              {field.supportedKind === "text" && (
                <TextField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "number" && (
                <NumberField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "boolean" && (
                <BooleanField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "richtext" && (
                <RichTextField field={field} control={control} />
              )}
              {field.supportedKind === "unsupported" && (
                <UnsupportedField field={field} />
              )}
            </FieldRow>
          );
        })}
      </div>

      <footer className="border-t border-border p-4">
        {blockSave ? (
          <p role="alert" className="mb-2 text-sm text-red-600">
            Remove unsupported content before saving —{" "}
            {richtextIssues
              .map(
                (issue) =>
                  `${humanizeFieldName(issue.name)}: ${issue.dropped.join(", ")}`,
              )
              .join("; ")}
            . Or edit it in the CMS.
          </p>
        ) : error ? (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isDirty || pending || blockSave}
            className="flex-1 rounded-md bg-dark px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </footer>
    </form>
  );
}
