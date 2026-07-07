'use client';

/** The schema-driven entry form: renders every field + optional debounced autosave. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import type { Type } from '@usc/zero-cms-core';
import { FieldControl, type FormValues } from '../registry';
import { Button, cx } from '../../components/ui';
import { cleanValues } from '../../util';

/** Scrolls into view + glows when this is the focused field (in-place edit). */
function FieldHighlight({
  highlighted,
  children,
}: {
  highlighted: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlighted) return;
    try {
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* scrollIntoView is unavailable in jsdom / SSR */
    }
  }, [highlighted]);
  return (
    <div
      ref={ref}
      className={cx(
        'rounded-md p-1 transition',
        highlighted && 'ring-2 ring-amber-400 ring-offset-2'
      )}
    >
      {children}
    </div>
  );
}

// Delay before an idle edit is auto-saved, and how often the countdown ticks.
const AUTOSAVE_DELAY_MS = 1500;
const AUTOSAVE_TICK_MS = 100;

export interface EntryFormProps {
  type: Type;
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => void | Promise<void>;
  submitLabel?: string;
  footer?: ReactNode;
  /** Field `__name` to scroll to + highlight (in-place edit from the widget). */
  focusField?: string;
  /**
   * Enable autosave: called (without closing) ~1.5s after edits settle. Provide
   * only for existing entries — the caller persists to `__draft`. Rejecting stops
   * the write; the next edit re-arms.
   */
  autosave?: (values: FormValues) => void | Promise<void>;
}

export function EntryForm({
  type,
  defaultValues,
  onSubmit,
  submitLabel = 'Save draft',
  footer,
  focusField,
  autosave,
}: EntryFormProps) {
  const { control, handleSubmit, reset, getValues } = useForm<FormValues>({
    defaultValues: defaultValues as DefaultValues<FormValues>,
  });

  const [autoSaveOn, setAutoSaveOn] = useState(true);
  // Seconds until the pending autosave fires (null = none armed).
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // Brief "Saved ✓" confirmation shown after an autosave settles.
  const [savedFlash, setSavedFlash] = useState(false);
  const savingRef = useRef(false);
  // Signature of the last-persisted values; edits past it arm an autosave.
  const baselineRef = useRef(JSON.stringify(cleanValues(defaultValues)));
  const deadlineRef = useRef<number | null>(null);

  // Reset when the edited entry changes.
  const key = useMemo(() => JSON.stringify(defaultValues), [defaultValues]);
  useEffect(() => {
    reset(defaultValues);
    baselineRef.current = JSON.stringify(cleanValues(defaultValues));
    deadlineRef.current = null;
    setSecondsLeft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const watched = useWatch({ control });
  const watchedSignature = JSON.stringify(cleanValues((watched ?? {}) as FormValues));

  const runAutoSave = () => {
    if (!autosave || !autoSaveOn || savingRef.current) return;
    const values = getValues();
    const signature = JSON.stringify(cleanValues(values));
    if (signature === baselineRef.current) return;
    savingRef.current = true;
    setIsAutoSaving(true);
    Promise.resolve(autosave(values))
      .then(() => {
        baselineRef.current = signature;
        setSavedFlash(true);
      })
      .catch(() => {
        // Leave the baseline so the next edit re-arms; the caller surfaces the error.
      })
      .finally(() => {
        savingRef.current = false;
        setIsAutoSaving(false);
      });
  };

  // Auto-clear the "Saved ✓" confirmation shortly after it appears.
  useEffect(() => {
    if (!savedFlash) return;
    const id = window.setTimeout(() => setSavedFlash(false), 2000);
    return () => window.clearTimeout(id);
  }, [savedFlash]);

  // (Re)arm the debounce deadline whenever the edited values or eligibility
  // change. A failed save leaves the signature dirty but doesn't re-run this
  // (deps unchanged) — so it retries on the next edit, not in a loop.
  useEffect(() => {
    deadlineRef.current =
      !autosave || !autoSaveOn || watchedSignature === baselineRef.current
        ? null
        : Date.now() + AUTOSAVE_DELAY_MS;
  }, [watchedSignature, autoSaveOn, autosave]);

  // Tick: surface the remaining seconds and fire once the deadline passes.
  useEffect(() => {
    if (!autosave || !autoSaveOn) return;
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
  }, [autosave, autoSaveOn]);

  const autosaveActive = Boolean(autosave) && autoSaveOn;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {type.fields.map((f) => (
        <FieldHighlight key={f.__name} highlighted={f.__name === focusField}>
          <FieldControl field={f} control={control} />
        </FieldHighlight>
      ))}
      <div className="space-y-2 border-t border-neutral-100 pt-3">
        {/* One flat, wrap-safe row of uniform buttons so state-conditional actions
            (Discard/Unpublish) can appear without reshuffling the layout. The manual
            "Save draft" is redundant while autosave is armed, so it's hidden then. */}
        <div className="flex flex-wrap items-center gap-2">
          {!autosaveActive && (
            <Button type="submit" variant="primary">
              {submitLabel}
            </Button>
          )}
          {footer}
        </div>
        {autosave && (
          <div className="flex min-h-5 items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={autoSaveOn}
                onChange={(e) => setAutoSaveOn(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-neutral-500">Auto-save changes</span>
            </label>
            {autoSaveOn && (isAutoSaving || secondsLeft !== null || savedFlash) ? (
              <span className="text-xs text-neutral-400" aria-live="polite">
                {isAutoSaving
                  ? 'Auto-saving…'
                  : secondsLeft !== null
                    ? `Auto-saving in ${secondsLeft.toFixed(1)}s`
                    : 'Saved ✓'}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </form>
  );
}
