'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { useZeroCms } from '../../context';

export const BlocksFieldRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { Blocks } = useZeroCms();
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Blocks value={(f.value as never) ?? []} onChange={f.onChange} />
      )}
    />
  );
};
