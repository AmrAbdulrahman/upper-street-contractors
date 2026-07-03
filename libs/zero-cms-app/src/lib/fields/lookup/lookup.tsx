'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Select } from '../../components/ui';

export const LookupRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const options = field.__type === 'lookup' ? field.options : [];
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Select value={(f.value as string) ?? ''} onChange={f.onChange}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )}
    />
  );
};
