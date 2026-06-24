"use client";

import { useState, useTransition } from "react";
import { Controller, type Control } from "react-hook-form";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { listEntries } from "@/lib/entry-editor/actions";
import type {
  EntryFieldDescriptor,
  RelationRef,
} from "@/lib/entry-editor/types";
import { FIELD_INPUT_CLASS, humanizeFieldName, type FormValues } from "../ui";

const REMOVE_BUTTON_CLASS =
  "rounded border border-border px-1.5 text-xs text-muted transition-colors hover:bg-surface disabled:opacity-40";

/** One draggable row in a multi-relation list: handle, label, remove. */
function SortableRelationItem({
  reference,
  index,
  onRemove,
}: {
  reference: RelationRef;
  index: number;
  onRemove: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: reference.documentId,
    index,
  });

  return (
    <li
      ref={ref}
      className={[
        "flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm transition-opacity",
        isDragging ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reorder ${reference.label}`}
        className="shrink-0 cursor-grab touch-none px-0.5 text-muted hover:text-foreground active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {reference.label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${reference.label}`}
        className={REMOVE_BUTTON_CLASS}
      >
        ✕
      </button>
    </li>
  );
}

/**
 * Re-point editor for Strapi relations. Single (oneToOne/manyToOne) → a nullable
 * select; multi (oneToMany/manyToMany) → a drag-orderable list with add/remove.
 * Candidates are fetched lazily from the target collection on first focus.
 */
export function RelationField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const isMulti =
    field.relationCardinality === "oneToMany" ||
    field.relationCardinality === "manyToMany";
  const target = field.relationTargetSingular ?? "";
  const label = humanizeFieldName(field.name);

  const [candidates, setCandidates] = useState<RelationRef[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, startLoad] = useTransition();

  const ensureLoaded = () => {
    if (loaded || loading || !target) return;
    startLoad(async () => {
      setCandidates(await listEntries(target));
      setLoaded(true);
    });
  };

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => {
        if (isMulti) {
          const selected = (f.value as RelationRef[] | undefined) ?? [];
          const selectedIds = new Set(selected.map((ref) => ref.documentId));
          const available = candidates.filter(
            (candidate) => !selectedIds.has(candidate.documentId),
          );

          const remove = (index: number) =>
            f.onChange(selected.filter((_, i) => i !== index));
          const add = (documentId: string) => {
            const ref = candidates.find((c) => c.documentId === documentId);
            if (ref) f.onChange([...selected, ref]);
          };

          return (
            <div className="space-y-2">
              {selected.length === 0 ? (
                <p className="text-sm text-subtle">None selected.</p>
              ) : (
                <DragDropProvider
                  onDragEnd={(event) => {
                    const orderedIds = move(
                      selected.map((ref) => ref.documentId),
                      event,
                    );
                    const byId = new Map(
                      selected.map((ref) => [ref.documentId, ref] as const),
                    );
                    f.onChange(
                      orderedIds
                        .map((id) => byId.get(id))
                        .filter((ref): ref is RelationRef => Boolean(ref)),
                    );
                  }}
                >
                  <ul className="space-y-1">
                    {selected.map((ref, index) => (
                      <SortableRelationItem
                        key={ref.documentId}
                        reference={ref}
                        index={index}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </ul>
                </DragDropProvider>
              )}

              <select
                value=""
                onFocus={ensureLoaded}
                onChange={(event) => {
                  if (event.target.value) add(event.target.value);
                }}
                aria-label={`Add ${label}`}
                autoFocus={autoFocus}
                className={FIELD_INPUT_CLASS}
              >
                <option value="">{loading ? "Loading…" : "+ Add…"}</option>
                {available.map((candidate) => (
                  <option key={candidate.documentId} value={candidate.documentId}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        // Single relation.
        const current = (f.value as RelationRef | null) ?? null;
        const merged =
          current && !candidates.some((c) => c.documentId === current.documentId)
            ? [current, ...candidates]
            : candidates;

        return (
          <select
            value={current?.documentId ?? ""}
            onFocus={ensureLoaded}
            onChange={(event) => {
              const next =
                merged.find((c) => c.documentId === event.target.value) ?? null;
              f.onChange(event.target.value ? next : null);
            }}
            aria-label={label}
            autoFocus={autoFocus}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">{loading ? "Loading…" : "— none —"}</option>
            {merged.map((candidate) => (
              <option key={candidate.documentId} value={candidate.documentId}>
                {candidate.label}
              </option>
            ))}
          </select>
        );
      }}
    />
  );
}
