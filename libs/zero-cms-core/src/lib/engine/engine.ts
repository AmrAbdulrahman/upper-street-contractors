/**
 * Engine — all zero-cms logic over a {@link StoragePort} + {@link BlobStore}.
 *
 * Rewritten for multi-writer, per-entry optimistic concurrency (ADR 0009,
 * superseding the single-writer/whole-file model in ADR 0003). No entry array
 * is held canonically in memory any more — every read fetches fresh through
 * the port (reads MAY be cache-served by the port itself; the Engine never
 * assumes so), and every mutation re-validates against the port's current
 * stored value at write time via a compare-and-swap on `__lastEditedAt`
 * (Entries/Media) or `updatedAt` (Users). A mismatch fails closed with a
 * `CONFLICT` error — the caller must reload and retry.
 *
 * Only the Schema stays a single cached document per Engine instance (ADR 0011)
 * — schema changes are rare and effectively one-admin-at-a-time, so a whole-
 * document CAS (not per-Type) is the right granularity.
 *
 * The in-process {@link Mutex} still serializes concurrent calls *within* one
 * warm process/instance (cheap, avoids interleaving oddities) — it is no
 * longer the correctness mechanism for cross-process safety; the CAS is.
 */

import type { Schema, Type } from '../model/schema';
import type { Entry, EntryValues, ReadStatus } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { MediaItem } from '../model/media';
import { kindFromMime } from '../model/media';
import { ZeroCmsError, type ReferenceHit } from '../model/errors';
import type { StoragePort, BlobStore } from './storage-port';
import { Mutex } from './mutex';
import { newId } from './ids';
import { SchemaIndex } from './schema-index';
import { assertValid, validateValues } from './validation';
import { findDanglingReferences, findReferencesTo } from './integrity';
import { evaluateQuery, visibleAt } from './query-engine';
import { resolveOutput, type OutputEntry, type ResolveCtx } from './output';
import { applySchemaDefaults } from './projection';
import { nextTimestamp } from './clock';

export interface BackfillSpec {
  type: string;
  field: string;
  default: unknown;
}

export class Engine {
  private readonly mutex = new Mutex();
  private schema: Schema;
  private schemaVersion: string | null;
  private index: SchemaIndex;

  private constructor(
    private readonly port: StoragePort,
    private readonly blobs: BlobStore,
    schemaRecord: { schema: Schema; version: string } | null
  ) {
    this.schema = schemaRecord?.schema ?? [];
    this.schemaVersion = schemaRecord?.version ?? null;
    this.index = new SchemaIndex(this.schema);
  }

  static async load(port: StoragePort, blobs: BlobStore): Promise<Engine> {
    const schemaRecord = await port.readSchema();
    return new Engine(port, blobs, schemaRecord);
  }

  private type(typeName: string): Type {
    return this.index.get(typeName);
  }

  private ctx(): ResolveCtx {
    return {
      schema: this.index,
      fetchEntry: async (id) => {
        const e = await this.port.readEntry(id);
        return e ? this.projected(e) : null;
      },
    };
  }

  /** Apply ADR 0011 read-time schema projection to one entry's stored bags. */
  private projected(entry: Entry): Entry {
    if (!this.index.has(entry.__type)) return entry;
    const type = this.index.get(entry.__type);
    return {
      ...entry,
      values: entry.values ? applySchemaDefaults(type, entry.values) : entry.values,
      __draft: entry.__draft ? applySchemaDefaults(type, entry.__draft) : entry.__draft,
    };
  }

  private async fetchAllEntries(): Promise<Entry[]> {
    const lists = await Promise.all(
      this.schema.map(async (t) => {
        const ids = await this.port.listEntryIds(t.__name);
        return this.port.readEntries(ids);
      })
    );
    return lists.flat();
  }

  private async require(typeName: string, id: string): Promise<Entry> {
    const e = await this.port.readEntry(id);
    if (!e || e.__type !== typeName)
      throw new ZeroCmsError('NOT_FOUND', `No ${typeName} with id "${id}"`);
    return this.projected(e);
  }

  private stampMutation(entry: Entry, actor: string): Entry {
    return { ...entry, __lastEditedAt: nextTimestamp(), __lastEditedBy: actor };
  }

  private async casWrite(id: string, expected: string, next: Entry): Promise<Entry> {
    const ok = await this.port.writeEntry(id, expected, next);
    if (!ok)
      throw new ZeroCmsError(
        'CONFLICT',
        `"${id}" was changed by someone else since you last read it — reload and retry`
      );
    return next;
  }

  // ---- schema -------------------------------------------------------------

  getSchema(): Schema {
    return this.schema;
  }

  /**
   * The version token to present back to `saveSchema` (ADR 0009). Always a
   * fresh read from the port, never the instance's own cached
   * `this.schemaVersion` — that cache can be stale across the multiple
   * concurrent serverless instances Vercel runs (each a separate Engine),
   * so trusting it for the CAS check would defeat the check entirely.
   */
  async getSchemaVersion(): Promise<string | null> {
    const rec = await this.port.readSchema();
    return rec?.version ?? null;
  }

  async saveSchema(
    input: Schema,
    actor: string,
    expectedVersion: string | null,
    backfill: BackfillSpec[] = []
  ): Promise<Schema> {
    return this.mutex.run(async () => {
      // Fresh read (like getSchemaVersion) rather than the cached `this.schema`
      // — this instance's cache can be stale across concurrent serverless
      // instances, and the per-Type __createdAt/__updatedAt stamp below must
      // diff against what's actually stored, not a possibly-stale snapshot.
      const previous = (await this.port.readSchema())?.schema ?? [];
      const next = stampSchema(input, previous, nextTimestamp());
      const nextIndex = new SchemaIndex(next);
      const allEntries = await this.fetchAllEntries();
      // Block destructive edits that would invalidate existing published values.
      const offenders: Array<{ id: string; type: string; issues: unknown }> = [];
      for (const e of allEntries) {
        if (!nextIndex.has(e.__type)) {
          offenders.push({ id: e.__id, type: e.__type, issues: 'type removed' });
          continue;
        }
        if (e.__status === 'published' && e.values) {
          const issues = validateValues(nextIndex.get(e.__type), e.values, false);
          if (issues.length) offenders.push({ id: e.__id, type: e.__type, issues });
        }
      }
      if (offenders.length)
        throw new ZeroCmsError(
          'DESTRUCTIVE_SCHEMA_EDIT',
          'Schema change would invalidate existing entries',
          offenders
        );

      const written = await this.port.writeSchema(next, expectedVersion);
      if (!written)
        throw new ZeroCmsError(
          'CONFLICT',
          'Schema was changed by someone else since you last read it — reload and retry'
        );
      this.schema = written.schema;
      this.schemaVersion = written.version;
      this.index = nextIndex;

      // Eager backfill (ADR 0011): per-entry CAS write, skip-and-log on
      // individual conflict rather than failing the whole schema change.
      for (const spec of backfill) {
        const ids = await this.port.listEntryIds(spec.type);
        const entries = await this.port.readEntries(ids);
        for (const entry of entries) {
          const patchBag = (bag: EntryValues | null): EntryValues | null => {
            if (!bag || spec.field in bag) return bag;
            return { ...bag, [spec.field]: spec.default };
          };
          const values = patchBag(entry.values);
          const draft = patchBag(entry.__draft);
          if (values === entry.values && draft === entry.__draft) continue; // already has it
          const updated = this.stampMutation({ ...entry, values, __draft: draft }, actor);
          const ok = await this.port.writeEntry(entry.__id, entry.__lastEditedAt, updated);
          if (!ok) {
            console.warn(
              `[zero-cms] backfill of "${spec.field}" on ${spec.type}/${entry.__id} skipped — ` +
                `entry was concurrently edited; it will pick up the default via read-time ` +
                `projection until someone re-saves it.`
            );
          }
        }
      }

      return written.schema;
    });
  }

  // ---- entry mutations ----------------------------------------------------

  async create(typeName: string, values: EntryValues, actor: string): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const type = this.type(typeName);
      assertValid(type, values, false);
      const now = nextTimestamp();
      const entry: Entry = {
        __id: newId(),
        __type: typeName,
        __status: 'unpublished',
        values: null,
        __draft: values,
        __createdAt: now,
        __lastEditedAt: now,
        __lastEditedBy: actor,
      };
      // No CAS — a freshly generated id cannot collide with a concurrent write.
      await this.port.createEntry(entry);
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  /** Full replace of pending values (writes the draft, not live values). */
  async update(
    typeName: string,
    id: string,
    values: EntryValues,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = await this.require(typeName, id);
      assertValid(this.type(typeName), values, false);
      const next = this.stampMutation({ ...entry, __draft: values }, actor);
      const written = await this.casWrite(id, expectedLastEditedAt, next);
      return resolveOutput(written, 'draft', undefined, this.ctx());
    });
  }

  /** Shallow-merge into the pending draft. */
  async patch(
    typeName: string,
    id: string,
    partial: EntryValues,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = await this.require(typeName, id);
      const base = entry.__draft ?? entry.values ?? {};
      const merged = { ...base, ...partial };
      assertValid(this.type(typeName), merged, false);
      const next = this.stampMutation({ ...entry, __draft: merged }, actor);
      const written = await this.casWrite(id, expectedLastEditedAt, next);
      return resolveOutput(written, 'draft', undefined, this.ctx());
    });
  }

  async delete(
    typeName: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<void> {
    return this.mutex.run(async () => {
      await this.require(typeName, id);
      const allEntries = await this.fetchAllEntries();
      const hits: ReferenceHit[] = findReferencesTo(id, allEntries, this.index);
      if (hits.length)
        throw new ZeroCmsError(
          'REFERENCE_INTEGRITY',
          `Entry "${id}" is referenced by ${hits.length} field(s)`,
          hits
        );
      const ok = await this.port.deleteEntry(id, expectedLastEditedAt);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `"${id}" was changed by someone else since you last read it — reload and retry`
        );
    });
  }

  async publish(
    typeName: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = await this.require(typeName, id);
      const nextValues = entry.__draft ?? entry.values;
      if (!nextValues)
        throw new ZeroCmsError('VALIDATION', `Nothing to publish for "${id}"`);
      assertValid(this.type(typeName), nextValues, true);
      const next = this.stampMutation(
        { ...entry, values: nextValues, __draft: null, __status: 'published' },
        actor
      );
      const written = await this.casWrite(id, expectedLastEditedAt, next);
      return resolveOutput(written, 'published', undefined, this.ctx());
    });
  }

  async unpublish(
    typeName: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = await this.require(typeName, id);
      const next = this.stampMutation({ ...entry, __status: 'unpublished' }, actor);
      const written = await this.casWrite(id, expectedLastEditedAt, next);
      return resolveOutput(written, 'draft', undefined, this.ctx());
    });
  }

  async discardDraft(
    typeName: string,
    id: string,
    actor: string,
    expectedLastEditedAt: string
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = await this.require(typeName, id);
      const next = this.stampMutation({ ...entry, __draft: null }, actor);
      const written = await this.casWrite(id, expectedLastEditedAt, next);
      return resolveOutput(written, 'draft', undefined, this.ctx());
    });
  }

  // ---- reads --------------------------------------------------------------

  async get(typeName: string, id: string, opts: GetOptions = {}): Promise<OutputEntry | null> {
    const status: ReadStatus = opts.status ?? 'published';
    const raw = await this.port.readEntry(id);
    if (!raw || raw.__type !== typeName) return null;
    const entry = this.projected(raw);
    const includeAll = status === 'draft' && opts.includeUnpublished === true;
    if (!includeAll && !visibleAt(entry, status)) return null;
    return resolveOutput(entry, status, opts.populate, this.ctx());
  }

  async query(typeName: string, input: QueryInput = {}): Promise<QueryResult<OutputEntry>> {
    this.type(typeName); // assert type exists
    const status: ReadStatus = input.status ?? 'published';
    const ids = await this.port.listEntryIds(typeName);
    const raw = await this.port.readEntries(ids);
    const ofType = raw.map((e) => this.projected(e));
    const { rows, total } = evaluateQuery(ofType, input);
    const data = await Promise.all(
      rows.map((r) => resolveOutput(r.entry, status, input.populate, this.ctx()))
    );
    return { data, total };
  }

  /**
   * Every entry across *all* Types that currently has a pending draft — backs
   * the editor bar's "publish all drafts" button. Reads the storage port's
   * maintained index (2 round trips total), not one `query()` per Type in the
   * schema (2 round trips *each*, previously the only way to ask "does this
   * Type have any hasDraft entries" — with dozens of Types, that added up to
   * a genuinely slow scan just to render a count).
   */
  async listDrafts(): Promise<{ id: string; type: string; lastEditedAt: string }[]> {
    const ids = await this.port.listDraftEntryIds();
    if (ids.length === 0) return [];
    const entries = await this.port.readEntries(ids);
    return entries.map((e) => ({ id: e.__id, type: e.__type, lastEditedAt: e.__lastEditedAt }));
  }

  /** Resolve an entry's Type from its id alone (e.g. for the in-place widget). */
  async locate(id: string): Promise<{ id: string; type: string } | null> {
    const e = await this.port.readEntry(id);
    return e ? { id: e.__id, type: e.__type } : null;
  }

  /** Non-blocking helper: dangling/invalid references for an entry (warnings). */
  async validateRefs(typeName: string, id: string) {
    const entry = await this.require(typeName, id);
    const bag = entry.__draft ?? entry.values;
    const refFields = this.index.has(typeName) ? this.index.referenceFields(typeName) : [];
    const refIds = new Set<string>();
    if (bag) {
      for (const f of refFields) {
        const v = bag[f.__name];
        if (typeof v === 'string') refIds.add(v);
        else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && refIds.add(x));
      }
    }
    const targets = await Promise.all([...refIds].map((rid) => this.port.readEntry(rid)));
    const byId = new Map(targets.filter((t): t is Entry => t !== null).map((t) => [t.__id, t]));
    return findDanglingReferences(entry, byId, this.index);
  }

  // ---- media --------------------------------------------------------------

  async listMedia(): Promise<MediaItem[]> {
    const ids = await this.port.listMediaIds();
    const items = await Promise.all(ids.map((id) => this.port.readMediaItem(id)));
    return items.filter((i): i is MediaItem => i !== null);
  }

  async putMedia(
    bytes: Uint8Array,
    meta: {
      filename: string;
      mime: string;
      width?: number;
      height?: number;
      alternativeText?: string;
    },
    actor: string
  ): Promise<MediaItem> {
    return this.mutex.run(async () => {
      const id = newId();
      const { url } = await this.blobs.put(`media/${id}/${meta.filename}`, bytes, meta.mime);
      const now = nextTimestamp();
      const item: MediaItem = {
        id,
        filename: meta.filename,
        url,
        mime: meta.mime,
        size: bytes.byteLength,
        kind: kindFromMime(meta.mime),
        width: meta.width,
        height: meta.height,
        alternativeText: meta.alternativeText,
        createdAt: now,
        updatedAt: now,
        lastEditedBy: actor,
      };
      // No CAS — a freshly generated id cannot collide with a concurrent write.
      await this.port.createMediaItem(item);
      return item;
    });
  }

  async getMedia(id: string): Promise<{ item: MediaItem; bytes: Uint8Array }> {
    const item = await this.port.readMediaItem(id);
    if (!item) throw new ZeroCmsError('NOT_FOUND', `No media "${id}"`);
    return { item, bytes: await this.blobs.get(item.url) };
  }

  async deleteMedia(id: string, actor: string, expectedUpdatedAt: string): Promise<void> {
    return this.mutex.run(async () => {
      const item = await this.port.readMediaItem(id);
      if (!item) throw new ZeroCmsError('NOT_FOUND', `No media "${id}"`);
      const allEntries = await this.fetchAllEntries();
      const usage = this.findMediaUsage(id, allEntries);
      if (usage.length)
        throw new ZeroCmsError(
          'MEDIA_IN_USE',
          `Media "${id}" is used by ${usage.length} field(s)`,
          usage
        );
      void actor; // attribution not persisted past deletion — nothing left to stamp
      const ok = await this.port.deleteMediaItem(id, expectedUpdatedAt);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `Media "${id}" was changed by someone else since you last read it — reload and retry`
        );
      await this.blobs.delete(item.url);
    });
  }

  /** Update editable metadata (alt text) on a media item; bytes stay untouched. */
  async updateMediaMeta(
    id: string,
    meta: { alternativeText?: string },
    actor: string,
    expectedUpdatedAt: string
  ): Promise<MediaItem> {
    return this.mutex.run(async () => {
      const item = await this.port.readMediaItem(id);
      if (!item) throw new ZeroCmsError('NOT_FOUND', `No media "${id}"`);
      const next: MediaItem = {
        ...item,
        alternativeText: meta.alternativeText ?? item.alternativeText,
        updatedAt: nextTimestamp(),
        lastEditedBy: actor,
      };
      const ok = await this.port.writeMediaItem(id, expectedUpdatedAt, next);
      if (!ok)
        throw new ZeroCmsError(
          'CONFLICT',
          `Media "${id}" was changed by someone else since you last read it — reload and retry`
        );
      return next;
    });
  }

  private findMediaUsage(mediaId: string, entries: Entry[]) {
    const hits: ReferenceHit[] = [];
    for (const entry of entries) {
      if (!this.index.has(entry.__type)) continue;
      const assetFields = this.index
        .get(entry.__type)
        .fields.filter((f) => f.__type === 'asset');
      for (const slot of [
        { where: 'values' as const, bag: entry.values },
        { where: 'draft' as const, bag: entry.__draft },
      ]) {
        if (!slot.bag) continue;
        for (const f of assetFields) {
          if (slot.bag[f.__name] === mediaId)
            hits.push({
              fromId: entry.__id,
              fromType: entry.__type,
              field: f.__name,
              in: slot.where,
            });
        }
      }
    }
    return hits;
  }
}

/** The content that determines whether a Type "changed", excluding its stamps. */
function withoutStamps(t: Type): Pick<Type, '__name' | 'label' | 'fields'> {
  return { __name: t.__name, label: t.label, fields: t.fields };
}

/**
 * Stamp per-Type `__createdAt`/`__updatedAt` for a `saveSchema` call, matching
 * Types across `input`/`previous` by `__name` (the only stable identity a
 * Type has). Never trusts timestamps the client may have echoed back on
 * `input` — always recomputed from the diff against `previous`.
 */
function stampSchema(input: Schema, previous: Schema, now: string): Schema {
  const prevByName = new Map(previous.map((t) => [t.__name, t]));
  return input.map((t) => {
    const rest = withoutStamps(t);
    const prev = prevByName.get(t.__name);
    if (!prev) return { ...rest, __createdAt: now, __updatedAt: now };
    const unchanged = JSON.stringify(withoutStamps(prev)) === JSON.stringify(rest);
    return {
      ...rest,
      __createdAt: prev.__createdAt ?? now,
      __updatedAt: unchanged ? (prev.__updatedAt ?? now) : now,
    };
  });
}
