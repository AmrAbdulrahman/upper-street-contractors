'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { AssetPicker } from '../../components/asset-picker';

export const AssetRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const accept = field.__type === 'asset' ? field.accept ?? 'any' : 'any';
  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <AssetPicker
          value={(f.value as string) ?? ''}
          onChange={f.onChange}
          accept={accept}
        />
      )}
    />
  );
};
