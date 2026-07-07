'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Input } from '../../components/ui';

/** Calendar date (`date` kind) — an ISO 8601 `YYYY-MM-DD` string via a native date input. */
export const DateRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Input
        type="date"
        value={typeof f.value === 'string' ? f.value : ''}
        onChange={(e) => f.onChange(e.target.value)}
        onBlur={f.onBlur}
      />
    )}
  />
);
