'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';

export const BooleanRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-neutral-300"
          checked={Boolean(f.value)}
          onChange={(e) => f.onChange(e.target.checked)}
        />
        <span className="text-neutral-600">{f.value ? 'On' : 'Off'}</span>
      </label>
    )}
  />
);
