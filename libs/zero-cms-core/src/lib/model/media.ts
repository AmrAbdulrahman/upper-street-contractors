/**
 * Media model — `media/index.json` manifest entries.
 *
 * An `asset` field stores a media **id**; the manifest maps id → file metadata
 * so renames don't break references and the app has dimensions/mime to show.
 */

export interface MediaItem {
  /** Stable id stored by `asset` fields. */
  id: string;
  /** File name within `media/`. */
  filename: string;
  mime: string;
  /** Bytes. */
  size: number;
  /** Image/video kind, derived from mime. */
  kind: 'image' | 'video' | 'other';
  width?: number;
  height?: number;
  /** Alt text for images (accessibility). */
  alternativeText?: string;
  /** ISO timestamp. */
  createdAt: string;
}

export function kindFromMime(mime: string): MediaItem['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}
