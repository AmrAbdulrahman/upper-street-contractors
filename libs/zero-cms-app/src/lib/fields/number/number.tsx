'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Input } from '../../components/ui';

export const NumberRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Input
        type="number"
        value={f.value === '' || f.value == null ? '' : String(f.value)}
        step={field.__type === 'number' && field.integer ? 1 : 'any'}
        onChange={(e) => {
          const v = e.target.value;
          f.onChange(v === '' ? '' : Number(v));
        }}
        onBlur={f.onBlur}
      />
    )}
  />
);
