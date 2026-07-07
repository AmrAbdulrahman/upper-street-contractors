'use client';

/**
 * Field renderer registry keyed by `__type` (the in-place + full-form editing
 * surface). Each renderer lives in its own folder and is wired to react-hook-form
 * via Controller. `FieldControl` wraps the right renderer in the shared field shell.
 */

import { type ComponentType } from 'react';
import { useWatch } from 'react-hook-form';
import type { Field, FieldType } from '@usc/zero-cms-core';
import { Badge, Field as FieldShell, cls, cx } from '../../components/ui';
import { formatFieldValue, valuesEqual } from '../../util';
import type { FormValues, RendererProps } from './types';
import { TextRenderer } from '../text';
import { LongTextRenderer } from '../longtext';
import { RichTextRenderer } from '../richtext';
import { NumberRenderer } from '../number';
import { JsonRenderer } from '../json';
import { BlocksFieldRenderer } from '../blocks';
import { BooleanRenderer } from '../boolean';
import { LookupRenderer } from '../lookup';
import { AssetRenderer } from '../asset';
import { ReferenceRenderer } from '../reference';
import { ReferencesRenderer } from '../references';
import { DateRenderer } from '../date';

const labelOf = (f: Field) => f.label ?? f.__name;

export const fieldRegistry: Record<FieldType, ComponentType<RendererProps>> = {
  text: TextRenderer,
  longtext: LongTextRenderer,
  richtext: RichTextRenderer,
  blocks: BlocksFieldRenderer,
  number: NumberRenderer,
  json: JsonRenderer,
  boolean: BooleanRenderer,
  date: DateRenderer,
  lookup: LookupRenderer,
  asset: AssetRenderer,
  reference: ReferenceRenderer,
  references: ReferencesRenderer,
};

/** Type chip shown beside every field label (e.g. `asset`, `references`). */
function TypeBadge({ field }: { field: Field }) {
  return <Badge>{field.__type}</Badge>;
}

/** Small note rendered under a field whose value differs from what's live. */
function PublishedValueNote({ field, value }: { field: Field; value: unknown }) {
  return (
    <p className="text-xs text-amber-700">Published: {formatFieldValue(field, value)}</p>
  );
}

export function FieldControl({
  field,
  control,
  publishedValue,
  hasPublished,
}: RendererProps & {
  /** This field's value in the live published version, when there is one. */
  publishedValue?: unknown;
  /** Whether the entry has ever been published at all — gates the diff below. */
  hasPublished?: boolean;
}) {
  const Renderer = fieldRegistry[field.__type];
  const liveValue = useWatch({ control, name: field.__name as keyof FormValues });
  const changed = hasPublished && !valuesEqual(liveValue, publishedValue);
  const highlight = changed && 'rounded-md bg-amber-50 p-2 -m-2 ring-1 ring-amber-300';

  // Boolean bypasses FieldShell (its own <label> can't nest inside another
  // <label>), so it renders its own header row with the same label + type badge.
  if (field.__type === 'boolean')
    return (
      <div className={cx('space-y-1', highlight)}>
        <span className={cx(cls.label, 'flex items-center gap-2')}>
          <span>
            {labelOf(field)}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
          <TypeBadge field={field} />
        </span>
        <Renderer field={field} control={control} />
        {changed && <PublishedValueNote field={field} value={publishedValue} />}
      </div>
    );
  return (
    <div className={cx(highlight)}>
      <FieldShell
        label={labelOf(field)}
        required={field.required}
        badge={<TypeBadge field={field} />}
      >
        <Renderer field={field} control={control} />
      </FieldShell>
      {changed && <PublishedValueNote field={field} value={publishedValue} />}
    </div>
  );
}
