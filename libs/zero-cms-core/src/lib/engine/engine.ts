/**
 * Engine — all zero-cms logic over in-memory state + a {@link StoragePort}.
 *
 * Holds the loaded schema, entries and media index in memory. Every mutation
 * runs inside a single {@link Mutex} (single-writer, ADR 0003), updates memory,
 * then write-through-persists the whole file via the port (atomic on fs).
 *
 * Type-generic on purpose: the generated client wraps these calls into typed
 * per-Type Stores, and a future GraphQL layer calls the same methods.
 */

import type { Schema, Type } from '../model/schema';
import type { Entry, EntryValues, ReadStatus } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { MediaItem } from '../model/media';
import { kindFromMime } from '../model/media';
import { ZeroCmsError, type ReferenceHit } from '../model/errors';
import type { StoragePort } from './storage-port';
import { Mutex } from './mutex';
import { newId } from './ids';
import { SchemaIndex } from './schema-index';
import { assertValid, validateValues } from './validation';
import { findDanglingReferences, findReferencesTo } from './integrity';
import { evaluateQuery, visibleAt } from './query-engine';
import { resolveOutput, type OutputEntry } from './output';

export class Engine {
  private readonly mutex = new Mutex();
  private index: SchemaIndex;
  private byId = new Map<string, Entry>();

  private constructor(
    private readonly port: StoragePort,
    private schema: Schema,
    private entries: Entry[],
    private media: MediaItem[]
  ) {
    this.index = new SchemaIndex(schema);
    this.reindex();
  }

  static async load(port: StoragePort): Promise<Engine> {
    const [schema, data, media] = await Promise.all([
      port.readSchema(),
      port.readData(),
      port.readMediaIndex(),
    ]);
    return new Engine(port, schema ?? [], data ?? [], media);
  }

  private reindex(): void {
    this.byId = new Map(this.entries.map((e) => [e.__id, e]));
  }

  private require(typeName: string, id: string): Entry {
    const e = this.byId.get(id);
    if (!e || e.__type !== typeName)
      throw new ZeroCmsError('NOT_FOUND', `No ${typeName} with id "${id}"`);
    return e;
  }

  private ctx() {
    return { byId: this.byId, schema: this.index };
  }

  // ---- schema -------------------------------------------------------------

  getSchema(): Schema {
    return this.schema;
  }

  async saveSchema(next: Schema): Promise<Schema> {
    return this.mutex.run(async () => {
      const nextIndex = new SchemaIndex(next);
      // Block destructive edits that would invalidate existing published values.
      const offenders: Array<{ id: string; type: string; issues: unknown }> = [];
      for (const e of this.entries) {
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

      this.schema = next;
      this.index = nextIndex;
      await this.port.writeSchema(next);
      return next;
    });
  }

  private type(typeName: string): Type {
    return this.index.get(typeName);
  }

  // ---- entry mutations ----------------------------------------------------

  async create(typeName: string, values: EntryValues): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const type = this.type(typeName);
      assertValid(type, values, false);
      const entry: Entry = {
        __id: newId(),
        __type: typeName,
        __status: 'unpublished',
        values: null,
        __draft: values,
      };
      this.entries.push(entry);
      this.byId.set(entry.__id, entry);
      await this.persistData();
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  /** Full replace of pending values (writes the draft, not live values). */
  async update(typeName: string, id: string, values: EntryValues): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = this.require(typeName, id);
      assertValid(this.type(typeName), values, false);
      entry.__draft = values;
      await this.persistData();
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  /** Shallow-merge into the pending draft. */
  async patch(
    typeName: string,
    id: string,
    partial: EntryValues
  ): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = this.require(typeName, id);
      const base = entry.__draft ?? entry.values ?? {};
      const merged = { ...base, ...partial };
      assertValid(this.type(typeName), merged, false);
      entry.__draft = merged;
      await this.persistData();
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  async delete(typeName: string, id: string): Promise<void> {
    return this.mutex.run(async () => {
      this.require(typeName, id);
      const hits: ReferenceHit[] = findReferencesTo(id, this.entries, this.index);
      if (hits.length)
        throw new ZeroCmsError(
          'REFERENCE_INTEGRITY',
          `Entry "${id}" is referenced by ${hits.length} field(s)`,
          hits
        );
      this.entries = this.entries.filter((e) => e.__id !== id);
      this.byId.delete(id);
      await this.persistData();
    });
  }

  async publish(typeName: string, id: string): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = this.require(typeName, id);
      const next = entry.__draft ?? entry.values;
      if (!next)
        throw new ZeroCmsError('VALIDATION', `Nothing to publish for "${id}"`);
      assertValid(this.type(typeName), next, true);
      entry.values = next;
      entry.__draft = null;
      entry.__status = 'published';
      await this.persistData();
      return resolveOutput(entry, 'published', undefined, this.ctx());
    });
  }

  async unpublish(typeName: string, id: string): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = this.require(typeName, id);
      entry.__status = 'unpublished';
      await this.persistData();
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  async discardDraft(typeName: string, id: string): Promise<OutputEntry> {
    return this.mutex.run(async () => {
      const entry = this.require(typeName, id);
      entry.__draft = null;
      await this.persistData();
      return resolveOutput(entry, 'draft', undefined, this.ctx());
    });
  }

  // ---- reads --------------------------------------------------------------

  get(typeName: string, id: string, opts: GetOptions = {}): OutputEntry | null {
    const status: ReadStatus = opts.status ?? 'published';
    const entry = this.byId.get(id);
    if (!entry || entry.__type !== typeName) return null;
    const includeAll = status === 'draft' && opts.includeUnpublished === true;
    if (!includeAll && !visibleAt(entry, status)) return null;
    return resolveOutput(entry, status, opts.populate, this.ctx());
  }

  query(typeName: string, input: QueryInput = {}): QueryResult<OutputEntry> {
    this.type(typeName); // assert type exists
    const status: ReadStatus = input.status ?? 'published';
    const ofType = this.entries.filter((e) => e.__type === typeName);
    const { rows, total } = evaluateQuery(ofType, input);
    const data = rows.map((r) =>
      resolveOutput(r.entry, status, input.populate, this.ctx())
    );
    return { data, total };
  }

  /** Resolve an entry's Type from its id alone (e.g. for the in-place widget). */
  locate(id: string): { id: string; type: string } | null {
    const e = this.byId.get(id);
    return e ? { id: e.__id, type: e.__type } : null;
  }

  /** Non-blocking helper: dangling/invalid references for an entry (warnings). */
  validateRefs(typeName: string, id: string) {
    const entry = this.require(typeName, id);
    return findDanglingReferences(entry, this.byId, this.index);
  }

  // ---- media --------------------------------------------------------------

  listMedia(): MediaItem[] {
    return this.media;
  }

  async putMedia(
    bytes: Uint8Array,
    meta: {
      filename: string;
      mime: string;
      width?: number;
      height?: number;
      alternativeText?: string;
    }
  ): Promise<MediaItem> {
    return this.mutex.run(async () => {
      const id = newId();
      const stored = `${id}__${meta.filename}`;
      const item: MediaItem = {
        id,
        filename: stored,
        mime: meta.mime,
        size: bytes.byteLength,
        kind: kindFromMime(meta.mime),
        width: meta.width,
        height: meta.height,
        alternativeText: meta.alternativeText,
        createdAt: new Date().toISOString(),
      };
      await this.port.writeMediaFile(stored, bytes);
      this.media.push(item);
      await this.port.writeMediaIndex(this.media);
      return item;
    });
  }

  async getMedia(id: string): Promise<{ item: MediaItem; bytes: Uint8Array }> {
    const item = this.media.find((m) => m.id === id);
    if (!item) throw new ZeroCmsError('NOT_FOUND', `No media "${id}"`);
    return { item, bytes: await this.port.readMediaFile(item.filename) };
  }

  async deleteMedia(id: string): Promise<void> {
    return this.mutex.run(async () => {
      const item = this.media.find((m) => m.id === id);
      if (!item) throw new ZeroCmsError('NOT_FOUND', `No media "${id}"`);
      const usage = this.findMediaUsage(id);
      if (usage.length)
        throw new ZeroCmsError(
          'MEDIA_IN_USE',
          `Media "${id}" is used by ${usage.length} field(s)`,
          usage
        );
      this.media = this.media.filter((m) => m.id !== id);
      await this.port.writeMediaIndex(this.media);
      await this.port.deleteMediaFile(item.filename);
    });
  }

  private findMediaUsage(mediaId: string) {
    const hits: ReferenceHit[] = [];
    for (const entry of this.entries) {
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

  private async persistData(): Promise<void> {
    await this.port.writeData(this.entries);
  }
}
