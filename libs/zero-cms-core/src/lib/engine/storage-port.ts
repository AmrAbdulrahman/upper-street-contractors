/**
 * StoragePort — the low-level persistence boundary the Engine writes through.
 *
 * Redesigned for per-entry optimistic concurrency (ADR 0009) — the old shape
 * ("read everything, write the whole array back") assumed a single writer
 * process (ADR 0003) and cannot express a per-entry compare-and-swap. Every
 * mutating method here takes the caller's last-seen version token and returns
 * whether the write actually landed; a `false` means someone else changed that
 * record since the caller last read it (surfaced by the Engine as `CONFLICT`).
 *
 * `create*` methods take no expected version — ids are server-generated
 * (`newId()`), so a brand-new record can never collide with a concurrent write.
 *
 * The Engine holds all CMS logic; the port only reads/writes bytes/records.
 * This keeps the Engine storage-agnostic and testable with an in-memory port.
 */

import type { Schema } from '../model/schema';
import type { Entry } from '../model/entry';
import type { MediaItem } from '../model/media';
import type { User } from '../model/user';

/** Schema is one whole-document record — see ADR 0011 for why (not per-Type). */
export interface SchemaRecord {
  schema: Schema;
  /** Opaque version token (an ISO timestamp), compared for CAS on write. */
  version: string;
  /** Caller identity responsible for the last schema change. */
  lastEditedBy: string;
}

export interface StoragePort {
  /** `null` when no schema has been saved yet (fresh store). */
  readSchema(): Promise<SchemaRecord | null>;
  /**
   * `expectedVersion` must match the currently stored version (or be `null`
   * when creating the very first schema). Returns the new record, or `null`
   * on a version mismatch (conflict).
   */
  writeSchema(schema: Schema, expectedVersion: string | null): Promise<SchemaRecord | null>;

  readEntry(id: string): Promise<Entry | null>;
  /** All ids of a given type, for `query()`/listing. Order not guaranteed. */
  listEntryIds(type: string): Promise<string[]>;
  /**
   * Every entry id, across *all* Types, that currently has a pending draft
   * (`__draft !== null`) — a maintained index, kept in sync on every entry
   * write/delete, not derived by scanning every Type's entries. Backs the
   * editor bar's "publish all drafts" count, which otherwise has no cheap way
   * to answer "how many drafts exist" without reading every entry of every
   * Type in the schema.
   */
  listDraftEntryIds(): Promise<string[]>;
  /** Batch fetch (one round-trip where the backend supports it, e.g. Redis `MGET`). */
  readEntries(ids: string[]): Promise<Entry[]>;
  /** No CAS — `entry.__id` is freshly generated, cannot collide. */
  createEntry(entry: Entry): Promise<void>;
  /** `expectedLastEditedAt` must match the entry's currently stored value. */
  writeEntry(id: string, expectedLastEditedAt: string, next: Entry): Promise<boolean>;
  deleteEntry(id: string, expectedLastEditedAt: string): Promise<boolean>;

  readUser(id: string): Promise<User | null>;
  readUserByEmail(email: string): Promise<User | null>;
  listUserIds(): Promise<string[]>;
  createUser(user: User): Promise<void>;
  writeUser(id: string, expectedUpdatedAt: string, next: User): Promise<boolean>;
  deleteUser(id: string, expectedUpdatedAt: string): Promise<boolean>;

  /** Media metadata only — bytes live behind a separate {@link BlobStore}. */
  readMediaItem(id: string): Promise<MediaItem | null>;
  listMediaIds(): Promise<string[]>;
  createMediaItem(item: MediaItem): Promise<void>;
  writeMediaItem(id: string, expectedUpdatedAt: string, next: MediaItem): Promise<boolean>;
  deleteMediaItem(id: string, expectedUpdatedAt: string): Promise<boolean>;
}

/**
 * Media bytes — a separate, simpler concern from {@link StoragePort}. Each
 * upload is immutable once created (replace = delete + put), so there's no
 * CAS/versioning need here the way there is for the mutable JSON records above.
 */
export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
  get(url: string): Promise<Uint8Array>;
  delete(url: string): Promise<void>;
}
