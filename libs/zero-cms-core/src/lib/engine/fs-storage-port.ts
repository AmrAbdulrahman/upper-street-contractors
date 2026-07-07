/**
 * Filesystem StoragePort + BlobStore — local dev / tests only (ADR 0008: the
 * deployed reference server uses the Redis-backed port + Vercel Blob instead).
 *
 * Per-entry files, one JSON file per record — `data/<id>.json`, `users/<id>.json`,
 * `media/<id>/item.json` + `media/<id>/<filename>` — matching the Redis port's
 * per-record shape so both backends satisfy the same `StoragePort` contract
 * (ADR 0009: per-entry optimistic concurrency, not a single writer/whole-file
 * write-through as in the original ADR 0003 design). Schema stays one file
 * (`types.json`) — ADR 0011, a whole-document CAS is the right granularity there.
 *
 * The "compare-and-swap" here is a plain read-check-write, not truly atomic —
 * fine for local dev/tests (still effectively single-writer in practice); the
 * real cross-process guarantee is Redis's Lua `EVAL` in the production port.
 */

import { mkdir, readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StoragePort, SchemaRecord, BlobStore } from './storage-port';
import type { Schema } from '../model/schema';
import type { Entry } from '../model/entry';
import type { MediaItem } from '../model/media';
import type { User } from '../model/user';

/** The subset of {@link ZeroCmsConfig} the fs port needs. */
export interface FsStorageConfig {
  dir: string;
  mediaDir: string;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, data);
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

async function listJsonIds(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export function createFsStoragePort(config: FsStorageConfig): StoragePort {
  const dataDir = join(config.dir, 'data');
  const usersDir = join(config.dir, 'users');
  const mediaDir = config.mediaDir;
  const schemaFile = join(config.dir, 'types.json');

  const entryFile = (id: string) => join(dataDir, `${id}.json`);
  const userFile = (id: string) => join(usersDir, `${id}.json`);
  const mediaItemFile = (id: string) => join(mediaDir, id, 'item.json');

  return {
    async readSchema(): Promise<SchemaRecord | null> {
      return readJson<SchemaRecord>(schemaFile);
    },
    async writeSchema(schema: Schema, expectedVersion: string | null) {
      const current = await readJson<SchemaRecord>(schemaFile);
      if ((current?.version ?? null) !== expectedVersion) return null;
      const record: SchemaRecord = {
        schema,
        version: new Date().toISOString(),
        lastEditedBy: current?.lastEditedBy ?? 'system',
      };
      await writeAtomic(schemaFile, JSON.stringify(record, null, 2) + '\n');
      return record;
    },

    async readEntry(id) {
      return readJson<Entry>(entryFile(id));
    },
    async listEntryIds(type) {
      const ids = await listJsonIds(dataDir);
      const entries = await Promise.all(ids.map((id) => readJson<Entry>(entryFile(id))));
      return ids.filter((_, i) => entries[i]?.__type === type);
    },
    // Local dev/tests only — a plain scan is fine here (small datasets); the
    // Redis port maintains a real index since it's the one that actually
    // needs to avoid an all-Types scan (see redis-storage-port.ts).
    async listDraftEntryIds() {
      const ids = await listJsonIds(dataDir);
      const entries = await Promise.all(ids.map((id) => readJson<Entry>(entryFile(id))));
      return ids.filter((_, i) => entries[i]?.__draft != null);
    },
    async readEntries(ids) {
      const entries = await Promise.all(ids.map((id) => readJson<Entry>(entryFile(id))));
      return entries.filter((e): e is Entry => e !== null);
    },
    async createEntry(entry) {
      await writeAtomic(entryFile(entry.__id), JSON.stringify(entry, null, 2) + '\n');
    },
    async writeEntry(id, expectedLastEditedAt, next) {
      const current = await readJson<Entry>(entryFile(id));
      if (current?.__lastEditedAt !== expectedLastEditedAt) return false;
      await writeAtomic(entryFile(id), JSON.stringify(next, null, 2) + '\n');
      return true;
    },
    async deleteEntry(id, expectedLastEditedAt) {
      const current = await readJson<Entry>(entryFile(id));
      if (current?.__lastEditedAt !== expectedLastEditedAt) return false;
      await unlink(entryFile(id)).catch(() => undefined);
      return true;
    },

    async readUser(id) {
      return readJson<User>(userFile(id));
    },
    async readUserByEmail(email) {
      const ids = await listJsonIds(usersDir);
      const users = await Promise.all(ids.map((id) => readJson<User>(userFile(id))));
      const e = email.trim().toLowerCase();
      return users.find((u) => u?.email.toLowerCase() === e) ?? null;
    },
    async listUserIds() {
      return listJsonIds(usersDir);
    },
    async createUser(user) {
      await writeAtomic(userFile(user.__id), JSON.stringify(user, null, 2) + '\n');
    },
    async writeUser(id, expectedUpdatedAt, next) {
      const current = await readJson<User>(userFile(id));
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      await writeAtomic(userFile(id), JSON.stringify(next, null, 2) + '\n');
      return true;
    },
    async deleteUser(id, expectedUpdatedAt) {
      const current = await readJson<User>(userFile(id));
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      await unlink(userFile(id)).catch(() => undefined);
      return true;
    },

    async readMediaItem(id) {
      return readJson<MediaItem>(mediaItemFile(id));
    },
    async listMediaIds() {
      try {
        return await readdir(mediaDir);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
    async createMediaItem(item) {
      await writeAtomic(mediaItemFile(item.id), JSON.stringify(item, null, 2) + '\n');
    },
    async writeMediaItem(id, expectedUpdatedAt, next) {
      const current = await readJson<MediaItem>(mediaItemFile(id));
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      await writeAtomic(mediaItemFile(id), JSON.stringify(next, null, 2) + '\n');
      return true;
    },
    async deleteMediaItem(id, expectedUpdatedAt) {
      const current = await readJson<MediaItem>(mediaItemFile(id));
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      await unlink(mediaItemFile(id)).catch(() => undefined);
      return true;
    },
  };
}

/**
 * Local-disk BlobStore for the fs-backed adapter (local dev / tests). Keys
 * (`media/<id>/<filename>`, fully qualified by the caller — Engine — same as
 * the real Vercel Blob key convention) are rooted at `config.dir` directly,
 * *not* `config.mediaDir` — that dir is where media *metadata* (`item.json`)
 * lives, a separate namespace from blob bytes even though both start with
 * "media/" in their respective keys/paths.
 */
export function createFsBlobStore(config: FsStorageConfig): BlobStore {
  const path = (key: string) => join(config.dir, 'blobs', key);
  return {
    async put(key, bytes, _contentType) {
      void _contentType; // fs has no content-type metadata slot; url alone identifies it
      const file = path(key);
      await writeAtomic(file, bytes);
      return { url: `file://${file}` };
    },
    async get(url) {
      const file = url.replace(/^file:\/\//, '');
      return new Uint8Array(await readFile(file));
    },
    async delete(url) {
      const file = url.replace(/^file:\/\//, '');
      await unlink(file).catch(() => undefined);
    },
  };
}

/** In-memory StoragePort for tests. */
export function createMemoryStoragePort(seed?: {
  schema?: Schema;
  entries?: Entry[];
  media?: MediaItem[];
  users?: User[];
}): StoragePort {
  let schemaRecord: SchemaRecord | null = seed?.schema
    ? { schema: seed.schema, version: 'seed', lastEditedBy: 'system' }
    : null;
  const entries = new Map<string, Entry>((seed?.entries ?? []).map((e) => [e.__id, e]));
  const users = new Map<string, User>((seed?.users ?? []).map((u) => [u.__id, u]));
  const media = new Map<string, MediaItem>((seed?.media ?? []).map((m) => [m.id, m]));
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

  return {
    async readSchema() {
      return schemaRecord ? clone(schemaRecord) : null;
    },
    async writeSchema(schema, expectedVersion) {
      if ((schemaRecord?.version ?? null) !== expectedVersion) return null;
      schemaRecord = {
        schema: clone(schema),
        version: randomUUID(),
        lastEditedBy: schemaRecord?.lastEditedBy ?? 'system',
      };
      return clone(schemaRecord);
    },

    async readEntry(id) {
      const e = entries.get(id);
      return e ? clone(e) : null;
    },
    async listEntryIds(type) {
      return [...entries.values()].filter((e) => e.__type === type).map((e) => e.__id);
    },
    async listDraftEntryIds() {
      return [...entries.values()].filter((e) => e.__draft != null).map((e) => e.__id);
    },
    async readEntries(ids) {
      return ids.map((id) => entries.get(id)).filter((e): e is Entry => e !== undefined).map(clone);
    },
    async createEntry(entry) {
      entries.set(entry.__id, clone(entry));
    },
    async writeEntry(id, expectedLastEditedAt, next) {
      const current = entries.get(id);
      if (current?.__lastEditedAt !== expectedLastEditedAt) return false;
      entries.set(id, clone(next));
      return true;
    },
    async deleteEntry(id, expectedLastEditedAt) {
      const current = entries.get(id);
      if (current?.__lastEditedAt !== expectedLastEditedAt) return false;
      entries.delete(id);
      return true;
    },

    async readUser(id) {
      const u = users.get(id);
      return u ? clone(u) : null;
    },
    async readUserByEmail(email) {
      const e = email.trim().toLowerCase();
      const u = [...users.values()].find((x) => x.email.toLowerCase() === e);
      return u ? clone(u) : null;
    },
    async listUserIds() {
      return [...users.keys()];
    },
    async createUser(user) {
      users.set(user.__id, clone(user));
    },
    async writeUser(id, expectedUpdatedAt, next) {
      const current = users.get(id);
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      users.set(id, clone(next));
      return true;
    },
    async deleteUser(id, expectedUpdatedAt) {
      const current = users.get(id);
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      users.delete(id);
      return true;
    },

    async readMediaItem(id) {
      const m = media.get(id);
      return m ? clone(m) : null;
    },
    async listMediaIds() {
      return [...media.keys()];
    },
    async createMediaItem(item) {
      media.set(item.id, clone(item));
    },
    async writeMediaItem(id, expectedUpdatedAt, next) {
      const current = media.get(id);
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      media.set(id, clone(next));
      return true;
    },
    async deleteMediaItem(id, expectedUpdatedAt) {
      const current = media.get(id);
      if (current?.updatedAt !== expectedUpdatedAt) return false;
      media.delete(id);
      return true;
    },
  };
}

/** In-memory BlobStore for tests. */
export function createMemoryBlobStore(): BlobStore {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  let counter = 0;
  return {
    async put(key, bytes, contentType) {
      const url = `memory://${++counter}/${key}`;
      files.set(url, { bytes, contentType });
      return { url };
    },
    async get(url) {
      const f = files.get(url);
      if (!f) throw Object.assign(new Error(`No blob at ${url}`), { code: 'ENOENT' });
      return f.bytes;
    },
    async delete(url) {
      files.delete(url);
    },
  };
}
