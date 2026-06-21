"use client";

import { useState, useTransition } from "react";
import { Controller, type Control } from "react-hook-form";
import { listEntries } from "@/lib/entry-editor/actions";
import type {
  EntryFieldDescriptor,
  RelationRef,
} from "@/lib/entry-editor/types";
import { FIELD_INPUT_CLASS, humanizeFieldName, type FormValues } from "../ui";

const STEP_BUTTON_CLASS =
  "rounded border border-border px-1.5 text-xs text-muted transition-colors hover:bg-surface disabled:opacity-40";

/**
 * Re-point editor for Strapi relations (re-point only — editing the related
 * entry's own fields is out of scope). Single (oneToOne/manyToOne) → a nullable
 * select; multi (oneToMany/manyToMany) → an ordered list with add/remove and
 * up/down reordering (Strapi relations are ordered). Candidates are fetched
 * lazily from the target collection on first focus.
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

          const move = (index: number, delta: number) => {
            const target = index + delta;
            if (target < 0 || target >= selected.length) return;
            const next = [...selected];
            [next[index], next[target]] = [next[target], next[index]];
            f.onChange(next);
          };
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
                <ul className="space-y-1">
                  {selected.map((ref, index) => (
                    <li
                      key={ref.documentId}
                      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {ref.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${ref.label} up`}
                        className={STEP_BUTTON_CLASS}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === selected.length - 1}
                        aria-label={`Move ${ref.label} down`}
                        className={STEP_BUTTON_CLASS}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label={`Remove ${ref.label}`}
                        className={STEP_BUTTON_CLASS}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <select
                value=""
                onFocus={ensureLoaded}
                onChange={(event) => {
                  if (event.target.value) add(event.target.value);
                }}
                aria-label={`Add ${label}`}
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
