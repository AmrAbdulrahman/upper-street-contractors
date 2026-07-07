/**
 * Adapter — the high-level data port the generated client talks to (ADR 0004).
 *
 * Its methods mirror the Store operations but are type-generic. Two impls ship:
 * - `createNodeAdapter` — runs the Engine in-process.
 * - `createHttpAdapter` — forwards to the reference server over HTTP.
 *
 * Every mutating method takes a required `actor` (caller identity — a real
 * user id, or a fixed sentinel like `"system"`/`"migration"` for non-interactive
 * callers) — no anonymous default (ADR 0009). Methods that act on an existing
 * record (everything except `create`/`putMedia`, which can't conflict since
 * ids are server-generated) also take `expectedLastEditedAt`/`expectedUpdatedAt`
 * — the version token the caller last read for that record. A mismatch throws
 * `ZeroCmsError('CONFLICT', ...)`; the caller must reload and retry.
 *
 * The generated `createClient(adapter)` wraps an Adapter into typed per-Type Stores.
 */

import type { Schema } from '../model/schema';
import type { EntryValues } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { MediaItem } from '../model/media';
import type { OutputEntry } from '../engine/output';
import type { BackfillSpec } from '../engine/engine';

export interface DanglingRef {
  field: string;
  id: string;
  reason: 'missing' | 'wrong-type';
}

/** One entry with a pending draft — see {@link Adapter.listDrafts}. */
export interface DraftEntryRef {
  id: string;
  type: string;
  /** CAS token (ADR 0009) — present it back to `publish`. */
  lastEditedAt: string;
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
  /** The version token to present back to `saveSchema` (ADR 0009). */
  getSchemaVersion(): Promise<string | null>;
  /** `backfill` (ADR 0011) is optional — see `Engine.saveSchema`. */
  saveSchema(
    schema: Schema,
    actor: string,
    expectedVersion: string | null,
    backfill?: BackfillSpec[]
  ): Promise<Schema>;

  create(type: string, values: EntryValues, actor: string): Promise<OutputEntry>;
  update(
    type: string,
    id: string,
    values: EntryValues,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry>;
  patch(
    type: string,
    id: string,
    partial: EntryValues,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry>;
  delete(type: string, id: string, actor: string, expectedLastEditedAt: string): Promise<void>;
  publish(
    type: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry>;
  unpublish(
    type: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry>;
  discardDraft(
    type: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry>;

  get(type: string, id: string, opts?: GetOptions): Promise<OutputEntry | null>;
  query(type: string, input?: QueryInput): Promise<QueryResult<OutputEntry>>;
  /** Every entry across all Types with a pending draft (for "publish all"). */
  listDrafts(): Promise<DraftEntryRef[]>;
  validateRefs(type: string, id: string): Promise<DanglingRef[]>;
  /** Resolve an entry's Type from its id alone (used by the in-place widget). */
  locate(id: string): Promise<{ id: string; type: string } | null>;

  listMedia(): Promise<MediaItem[]>;
  putMedia(bytes: Uint8Array, meta: MediaUpload, actor: string): Promise<MediaItem>;
  /** Update editable media metadata (e.g. alt text); the bytes are unchanged. */
  updateMedia(
    id: string,
    meta: MediaMetaUpdate,
    actor: string,
    expectedUpdatedAt: string
  ): Promise<MediaItem>;
  getMedia(id: string): Promise<{ item: MediaItem; bytes: Uint8Array }>;
  deleteMedia(id: string, actor: string, expectedUpdatedAt: string): Promise<void>;
}
