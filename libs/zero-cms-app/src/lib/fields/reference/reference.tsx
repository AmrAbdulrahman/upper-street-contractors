'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Select } from '../../components/ui';
import { useEntryOptions } from '../entry-options';
import { SingleReferencePicker } from '../../components/reference-picker';

export const ReferenceRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const allowed = field.__type === 'reference' ? field.allowedTypes : [];
  const { options, visual } = useEntryOptions(allowed);
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) =>
        visual ? (
          <SingleReferencePicker
            value={(f.value as string) ?? ''}
            onChange={f.onChange}
            options={options}
          />
        ) : (
          <Select value={(f.value as string) ?? ''} onChange={f.onChange}>
            <option value="">— none —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )
      }
    />
  );
};
