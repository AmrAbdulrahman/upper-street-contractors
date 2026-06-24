"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { blocksToHtml, htmlToBlocks } from "@/lib/entry-editor/blocks-html";
import { updateEntryFields } from "@/lib/entry-editor/actions";
import type {
  EntryFieldDescriptor,
  EntryFormDescriptor,
  MediaFileRef,
  RelationRef,
} from "@/lib/entry-editor/types";
import { refreshChangedEntries } from "./changed-entries-store";
import { BooleanField } from "./fields/boolean-field";
import { EnumField } from "./fields/enum-field";
import { FieldRow } from "./fields/field-row";
import { JsonField } from "./fields/json-field";
import { MediaField } from "./fields/media-field";
import { NumberField } from "./fields/number-field";
import { RelationField } from "./fields/relation-field";
import { TextField } from "./fields/text-field";
import { UnsupportedField } from "./fields/unsupported-field";
import {
  flatJsonKeys,
  humanizeFieldName,
  isFlatScalarObject,
  jsonIsFlat,
  reconstructFlatJson,
  type FormValues,
} from "./ui";

// Delay before an idle edit is auto-saved, and how often the countdown ticks.
const AUTOSAVE_DELAY_MS = 1500;
const AUTOSAVE_TICK_MS = 100;

// HugeRTE is heavy — load it only when a richtext field is rendered.
const RichTextField = dynamic(() => import("./fields/rich-text-field"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-surface" />,
});

function isMultiRelation(field: EntryFieldDescriptor): boolean {
  return (
    field.relationCardinality === "oneToMany" ||
    field.relationCardinality === "manyToMany"
  );
}

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
    case "media":
      return (
        ((current as MediaFileRef | null)?.id ?? null) !==
        ((defaultValue as MediaFileRef | null)?.id ?? null)
      );
    case "relation":
      if (isMultiRelation(field)) {
        const currentIds = ((current as RelationRef[] | undefined) ?? []).map(
          (ref) => ref.documentId,
        );
        const defaultIds = (
          (defaultValue as RelationRef[] | undefined) ?? []
        ).map((ref) => ref.documentId);
        return JSON.stringify(currentIds) !== JSON.stringify(defaultIds);
      }
      return (
        ((current as RelationRef | null)?.documentId ?? null) !==
        ((defaultValue as RelationRef | null)?.documentId ?? null)
      );
    case "json":
      if (jsonIsFlat(field.value)) {
        return (
          JSON.stringify(
            reconstructFlatJson(
              current as Record<string, unknown> | undefined,
              field.value,
              field.jsonKeys,
            ),
          ) !==
          JSON.stringify(
            reconstructFlatJson(
              defaultValue as Record<string, unknown> | undefined,
              field.value,
              field.jsonKeys,
            ),
          )
        );
      }
      return String(current ?? "") !== String(defaultValue ?? "");
    case "enumeration":
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
        case "json": {
          const original = field.value;
          if (jsonIsFlat(original)) {
            const source = isFlatScalarObject(original) ? original : {};
            const obj: Record<string, unknown> = {};
            for (const key of flatJsonKeys(original, field.jsonKeys)) {
              const value = source[key];
              obj[key] =
                typeof value === "boolean"
                  ? value
                  : value == null
                    ? ""
                    : String(value);
            }
            values[field.name] = obj;
          } else {
            values[field.name] = JSON.stringify(original, null, 2);
          }
          break;
        }
        case "relation":
          values[field.name] = isMultiRelation(field)
            ? ((field.value as RelationRef[]) ?? [])
            : ((field.value as RelationRef | null) ?? null);
          break;
        case "media": {
          const media = field.value as MediaFileRef | null;
          values[field.name] = media?.id
            ? {
                id: media.id,
                name: media.name,
                url: media.url,
                mime: media.mime,
              }
            : null;
          break;
        }
        case "enumeration":
        case "text":
          values[field.name] = (field.value as string) ?? "";
          break;
        default:
          break;
      }
    }
    return values;
  }, [descriptor]);

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    defaultValues,
  });
  const watched = useWatch({ control });

  const [autoSave, setAutoSave] = useState(true);
  // Seconds remaining until the pending autosave fires (null = none pending).
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // Guards against manual + auto saves racing, and re-saving identical content.
  const savingRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const deadlineRef = useRef<number | null>(null);

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

  // Collect changed fields into a Strapi update payload, flagging invalid
  // number/JSON values. Shared by manual Save and autosave.
  const buildChanges = (values: FormValues) => {
    const changes: Record<string, unknown> = {};
    const invalid: string[] = [];
    const jsonInvalid: string[] = [];

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
      } else if (field.supportedKind === "enumeration") {
        // Empty selection clears the (nullable) enum.
        changes[field.name] = raw === "" || raw == null ? null : String(raw);
      } else if (field.supportedKind === "media") {
        // Single media → write the file id (or null to clear).
        changes[field.name] = (raw as MediaFileRef | null)?.id ?? null;
      } else if (field.supportedKind === "relation") {
        // `set` replaces the whole relation in the given order (handles
        // connect/disconnect + ordering in one go). Empty array clears it.
        const ids = isMultiRelation(field)
          ? ((raw as RelationRef[] | undefined) ?? []).map((ref) => ref.documentId)
          : (raw as RelationRef | null)
            ? [(raw as RelationRef).documentId]
            : [];
        changes[field.name] = { set: ids };
      } else if (field.supportedKind === "json") {
        if (jsonIsFlat(field.value)) {
          const obj = reconstructFlatJson(
            raw as Record<string, unknown> | undefined,
            field.value,
            field.jsonKeys,
          );
          const hasBadNumber = Object.values(obj).some(
            (value) => typeof value === "number" && Number.isNaN(value),
          );
          if (hasBadNumber) jsonInvalid.push(field.name);
          else changes[field.name] = obj;
        } else {
          try {
            changes[field.name] = JSON.parse(String(raw ?? "null"));
          } catch {
            jsonInvalid.push(field.name);
          }
        }
      } else {
        changes[field.name] = (raw as string) ?? "";
      }
    }

    return { changes, invalid, jsonInvalid };
  };

  const onSubmit = handleSubmit((values) => {
    // A disabled submit button still allows Enter-to-submit in some browsers.
    if (blockSave) return;

    const { changes, invalid, jsonInvalid } = buildChanges(values);

    if (invalid.length || jsonInvalid.length) {
      const message = [
        invalid.length ? `Enter a valid number for: ${invalid.join(", ")}` : "",
        jsonInvalid.length ? `Fix the JSON value for: ${jsonInvalid.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(". ");
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
        refreshChangedEntries();
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

  // Autosave: persists the draft 1.5s after edits settle, without closing the
  // drawer. Stays silent on validation errors (manual Save surfaces those) and
  // skips re-saving identical content to avoid loops.
  const runAutoSave = () => {
    if (!autoSave || blockSave || pending || savingRef.current) return;

    const { changes, invalid, jsonInvalid } = buildChanges(getValues());
    if (invalid.length || jsonInvalid.length) return;
    if (Object.keys(changes).length === 0) return;

    const signature = JSON.stringify(changes);
    if (signature === lastSavedRef.current) return;

    savingRef.current = true;
    setIsAutoSaving(true);
    updateEntryFields({
      typename: descriptor.typename,
      documentId: descriptor.documentId,
      changes,
    }).then((result) => {
      savingRef.current = false;
      setIsAutoSaving(false);
      if (result.ok) {
        lastSavedRef.current = signature;
        refreshChangedEntries();
        router.refresh();
        toast.success("Auto-saved");
      }
    });
  };

  // Arm/disarm the autosave deadline whenever eligibility or the edited values
  // change (each edit pushes the deadline out — debounce semantics). Ref writes
  // only; the ticker below owns every state update.
  const watchedSignature = JSON.stringify(watched ?? {});
  useEffect(() => {
    deadlineRef.current =
      !autoSave || !isDirty || blockSave || pending
        ? null
        : Date.now() + AUTOSAVE_DELAY_MS;
  }, [watchedSignature, autoSave, isDirty, blockSave, pending]);

  // While autosave is on, tick: surface the remaining seconds and fire the save
  // once the deadline passes.
  useEffect(() => {
    if (!autoSave) return;
    const id = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) {
        setSecondsLeft(null);
        return;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        deadlineRef.current = null;
        setSecondsLeft(null);
        runAutoSave();
        return;
      }
      setSecondsLeft(Number((remainingMs / 1000).toFixed(1)));
    }, AUTOSAVE_TICK_MS);
    return () => window.clearInterval(id);
    // runAutoSave reads fresh values via getValues()/refs when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave]);

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
              {field.supportedKind === "enumeration" && (
                <EnumField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "json" && (
                <JsonField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "media" && (
                <MediaField field={field} control={control} autoFocus={focused} />
              )}
              {field.supportedKind === "relation" && (
                <RelationField field={field} control={control} autoFocus={focused} />
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
            disabled={autoSave || !isDirty || pending || blockSave}
            className="flex-1 rounded-md bg-dark px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(event) => setAutoSave(event.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            <span className="text-sm text-muted">Auto-save changes</span>
          </label>
          {autoSave && (isAutoSaving || secondsLeft !== null) ? (
            <span className="text-xs text-subtle" aria-live="polite">
              {isAutoSaving
                ? "Auto-saving…"
                : `Auto-saving in ${(secondsLeft ?? 0).toFixed(1)}s`}
            </span>
          ) : null}
        </div>
      </footer>
    </form>
  );
}
