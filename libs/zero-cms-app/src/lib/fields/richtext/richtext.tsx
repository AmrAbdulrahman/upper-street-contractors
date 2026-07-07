'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { useZeroCms } from '../../context';

export const RichTextRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { RichText } = useZeroCms();
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <RichText value={(f.value as string) ?? ''} onChange={f.onChange} />
      )}
    />
  );
};
