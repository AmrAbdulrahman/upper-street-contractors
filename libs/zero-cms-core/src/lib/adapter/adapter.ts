/**
 * Adapter — the high-level data port the generated client talks to (ADR 0004).
 *
 * Its methods mirror the Store operations but are type-generic. Two impls ship:
 * - `createNodeFsAdapter` — runs the Engine in-process against the filesystem.
 * - `createHttpAdapter` — forwards to the reference server over HTTP.
 *
 * The generated `createClient(adapter)` wraps an Adapter into typed per-Type Stores.
 */

import type { Schema } from '../model/schema';
import type { EntryValues } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { MediaItem } from '../model/media';
import type { OutputEntry } from '../engine/output';

export interface DanglingRef {
  field: string;
  id: string;
  reason: 'missing' | 'wrong-type';
}

export interface MediaUpload {
  filename: string;
  mime: string;
  width?: number;
  height?: number;
  alternativeText?: string;
}

/** Editable media metadata. The file bytes + system fields stay immutable. */
export interface MediaMetaUpdate {
  alternativeText?: string;
}

export interface Adapter {
  getSchema(): Promise<Schema>;
  saveSchema(schema: Schema): Promise<Schema>;

  create(type: string, values: EntryValues): Promise<OutputEntry>;
  update(type: string, id: string, values: EntryValues): Promise<OutputEntry>;
  patch(type: string, id: string, partial: EntryValues): Promise<OutputEntry>;
  delete(type: string, id: string): Promise<void>;
  publish(type: string, id: string): Promise<OutputEntry>;
  unpublish(type: string, id: string): Promise<OutputEntry>;
  discardDraft(type: string, id: string): Promise<OutputEntry>;

  get(type: string, id: string, opts?: GetOptions): Promise<OutputEntry | null>;
  query(type: string, input?: QueryInput): Promise<QueryResult<OutputEntry>>;
  validateRefs(type: string, id: string): Promise<DanglingRef[]>;
  /** Resolve an entry's Type from its id alone (used by the in-place widget). */
  locate(id: string): Promise<{ id: string; type: string } | null>;

  listMedia(): Promise<MediaItem[]>;
  putMedia(bytes: Uint8Array, meta: MediaUpload): Promise<MediaItem>;
  /** Update editable media metadata (e.g. alt text); the bytes are unchanged. */
  updateMedia(id: string, meta: MediaMetaUpdate): Promise<MediaItem>;
  getMedia(id: string): Promise<{ item: MediaItem; bytes: Uint8Array }>;
  deleteMedia(id: string): Promise<void>;
}
