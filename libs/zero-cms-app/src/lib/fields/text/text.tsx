'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { Input } from '../../components/ui';

export const TextRenderer: ComponentType<RendererProps> = ({ field, control }) => (
  <Controller
    name={field.__name}
    control={control}
    render={({ field: f }) => (
      <Input value={(f.value as string) ?? ''} onChange={f.onChange} onBlur={f.onBlur} />
    )}
  />
);
