'use client';

import { type ComponentType } from 'react';
import { Controller } from 'react-hook-form';
import type { RendererProps } from '../registry/types';
import { useZeroCms } from '../../context';

export const BlocksFieldRenderer: ComponentType<RendererProps> = ({ field, control }) => {
  const { Blocks, adapter, currentUserId, refreshMedia } = useZeroCms();

  /**
   * The same upload path an `asset` field uses — `putMedia`, then the Media
   * library refresh — so an image dropped into rich text is a real item in the
   * library rather than a second, invisible store of files.
   *
   * A `blocks` image node holds a URL, not a media id (that is the Strapi
   * shape the model is compatible with), so what comes back here is the item's
   * `url`. The trade is that deleting the media item later leaves a broken
   * image rather than an empty field.
   */
  const uploadImage = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const item = await adapter.putMedia(
      bytes,
      { filename: file.name, mime: file.type || 'application/octet-stream' },
      currentUserId
    );
    await refreshMedia();
    return { url: item.url, alt: item.alternativeText ?? undefined };
  };

  return (
    <Controller
      name={field.__name}
      control={control}
      render={({ field: f }) => (
        <Blocks
          value={(f.value as never) ?? []}
          onChange={f.onChange}
          uploadImage={uploadImage}
        />
      )}
    />
  );
};
