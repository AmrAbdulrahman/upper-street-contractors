/**
 * Media model — `media/index.json` manifest entries.
 *
 * An `asset` field stores a media **id**; the manifest maps id → file metadata
 * so renames don't break references and the app has dimensions/mime to show.
 */

export interface MediaItem {
  /** Stable id stored by `asset` fields. */
  id: string;
  /** Original uploaded filename (display/download only — not a storage path). */
  filename: string;
  /** Blob URL the actual bytes live at (ADR 0008 — ​Vercel Blob, not local fs). */
  url: string;
  mime: string;
  /** Bytes. */
  size: number;
  /** Image/video kind, derived from mime. */
  kind: 'image' | 'video' | 'other';
  width?: number;
  height?: number;
  /** Alt text for images (accessibility). */
  alternativeText?: string;
  /** ISO timestamp, set once at upload. */
  createdAt: string;
  /**
   * Bumped on every mutation (currently just `updateMediaMeta`). Doubles as the
   * optimistic-concurrency token (ADR 0009), same role as Entry's `__lastEditedAt`.
   */
  updatedAt: string;
  /** Caller identity responsible for the last mutation. Required, no anonymous default. */
  lastEditedBy: string;
}

export function kindFromMime(mime: string): MediaItem['kind'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}
