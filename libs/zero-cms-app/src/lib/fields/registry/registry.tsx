'use client';

/**
 * Field renderer registry keyed by `__type` (the in-place + full-form editing
 * surface). Each renderer lives in its own folder and is wired to react-hook-form
 * via Controller. `FieldControl` wraps the right renderer in the shared field shell.
 */

import { type ComponentType } from 'react';
import type { Field, FieldType } from '@usc/zero-cms-core';
import { Badge, Field as FieldShell, cls, cx } from '../../components/ui';
import type { RendererProps } from './types';
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

export function FieldControl({ field, control }: RendererProps) {
  const Renderer = fieldRegistry[field.__type];
  // Boolean bypasses FieldShell (its own <label> can't nest inside another
  // <label>), so it renders its own header row with the same label + type badge.
  if (field.__type === 'boolean')
    return (
      <div className="space-y-1">
        <span className={cx(cls.label, 'flex items-center gap-2')}>
          <span>
            {labelOf(field)}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
          <TypeBadge field={field} />
        </span>
        <Renderer field={field} control={control} />
      </div>
    );
  return (
    <FieldShell
      label={labelOf(field)}
      required={field.required}
      badge={<TypeBadge field={field} />}
    >
      <Renderer field={field} control={control} />
    </FieldShell>
  );
}
