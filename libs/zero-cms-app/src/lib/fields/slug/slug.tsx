'use client';

/**
 * `slug` editor — a text input that **derives itself, then lets go**.
 *
 * While the field is blank (i.e. a brand-new entry) it mirrors the slugified
 * value of the field named by `from`, so typing a title fills the URL in for
 * free. The moment it is typed into — or opened on an entry that already has a
 * slug — it detaches permanently, because that value is a live URL and
 * rewording a title must never silently move it.
 *
 * The pattern is validated by core on every write ({@link SLUG_PATTERN}); this
 * shows the same rule inline so an editor sees it before the save fails.
 */

import { useEffect, useRef, type ComponentType } from 'react';
import { useController, useWatch, type Control } from 'react-hook-form';
import { SLUG_PATTERN } from '@usc/zero-cms-core';
import type { FormValues, RendererProps } from '../registry/types';
import { Input } from '../../components/ui';

/** `Kitchen Extensions: what to know` -> `kitchen-extensions-what-to-know`. */
export function slugify(input: string): string {
  return (
    input
      // Decompose accents so the diacritic marks can be dropped rather than
      // becoming hyphens — "Café" should be "cafe", not "caf-".
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

function SlugInput({
  name,
  control,
  derived,
}: {
  name: string;
  control: Control<FormValues>;
  /** The slugified source value, or null when this slug derives from nothing. */
  derived: string | null;
}) {
  const { field: f } = useController({ name, control });
  const value = typeof f.value === 'string' ? f.value : '';

  // Ref, not state: detaching must not wait for a re-render, or one more source
  // keystroke would overwrite what the editor just typed. Initialised from the
  // value present on mount, so an existing slug is detached from the start.
  const detached = useRef(value !== '');
  const onChange = f.onChange;

  useEffect(() => {
    if (detached.current || derived === null || !derived || derived === value) return;
    onChange(derived);
  }, [derived, value, onChange]);

  const invalid = value !== '' && !SLUG_PATTERN.test(value);
  const errorId = `${name}-slug-error`;

  return (
    <>
      <Input
        value={value}
        onChange={(e) => {
          detached.current = true;
          onChange(e.target.value);
        }}
        onBlur={f.onBlur}
        spellCheck={false}
        autoCapitalize="off"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : undefined}
      />
      {invalid && (
        <span id={errorId} className="mt-1 block text-xs text-red-600">
          Lowercase words joined by hyphens only — e.g. {slugify(value) || 'my-post-title'}
        </span>
      )}
    </>
  );
}

/** Wraps {@link SlugInput} with a watch on the source field. */
function DerivedSlug({
  name,
  control,
  from,
}: {
  name: string;
  control: Control<FormValues>;
  from: string;
}) {
  const source = useWatch({ control, name: from });
  return (
    <SlugInput
      name={name}
      control={control}
      derived={typeof source === 'string' ? slugify(source) : ''}
    />
  );
}

export const SlugRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const from = field.__type === 'slug' ? field.from : undefined;
  // Two components rather than a conditional hook: `useWatch` needs a real field
  // name, and there isn't one to watch when the slug derives from nothing.
  return from ? (
    <DerivedSlug name={field.__name} control={control} from={from} />
  ) : (
    <SlugInput name={field.__name} control={control} derived={null} />
  );
};
