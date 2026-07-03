/**
 * Filesystem StoragePort.
 *
 * Schema is split across **per-type files** (one Type per file). On read we merge
 * the configured glob (default `<dir>/types/**\/*.json`) plus a legacy single
 * `types.json` (back-compat). Each Type remembers its source file; edits write back
 * there. New types — and any types that came from a multi-type ("shared") file or the
 * legacy `types.json` — are written to per-type files under `typesDir`, migrating the
 * schema to the split layout on first save.
 *
 * `data.json` and `media/` are single locations. All writes are crash-safe (temp file
 * + atomic `rename`).
 */

import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { globFiles } from './glob';
import type { StoragePort } from './storage-port';
import type { Schema, Type } from '../model/schema';
import type { Entry } from '../model/entry';
import type { MediaItem } from '../model/media';
import type { User } from '../model/user';

/** The subset of {@link ZeroCmsConfig} the fs port needs. */
export interface FsStorageConfig {
  dir: string;
  typesGlob: string;
  typesDir: string;
  dataFile: string;
  mediaDir: string;
  usersFile: string;
  legacyTypesFile: string;
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

function isType(v: unknown): v is Type {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Type).__name === 'string' &&
    Array.isArray((v as Type).fields)
  );
}

export function createFsStoragePort(config: FsStorageConfig): StoragePort {
  const mediaIndexFile = join(config.mediaDir, 'index.json');

  // Per-type provenance, rebuilt on every read.
  let originByName = new Map<string, string>();
  let sharedFiles = new Set<string>();

  async function listTypeFiles(): Promise<string[]> {
    return globFiles(config.typesGlob, config.dir);
  }

  return {
    async readSchema(): Promise<Schema | null> {
      originByName = new Map();
      sharedFiles = new Set();
      const merged = new Map<string, Type>();
      let any = false;

      const ingest = (path: string, parsed: unknown, legacy: boolean) => {
        const types = (Array.isArray(parsed) ? parsed : [parsed]).filter(isType);
        if (types.length === 0) return;
        any = true;
        const shared = legacy || types.length > 1;
        if (shared) sharedFiles.add(path);
        for (const t of types) {
          merged.set(t.__name, t);
          originByName.set(t.__name, path);
        }
      };

      // Legacy single file first (so glob files override on name clash).
      const legacy = await readJson<unknown>(config.legacyTypesFile);
      if (legacy != null) ingest(config.legacyTypesFile, legacy, true);

      for (const file of await listTypeFiles()) {
        if (file === config.legacyTypesFile) continue;
        const parsed = await readJson<unknown>(file);
        if (parsed != null) ingest(file, parsed, false);
      }

      return any ? [...merged.values()] : null;
    },

    async writeSchema(schema: Schema): Promise<void> {
      // Decide the destination file for each type: keep a dedicated origin, else
      // write a per-type file under typesDir (migrating shared/legacy/new types).
      const desired = new Map<string, { type: Type; path: string }>();
      for (const t of schema) {
        const origin = originByName.get(t.__name);
        const perType = join(config.typesDir, `${t.__name}.json`);
        const path = origin && !sharedFiles.has(origin) ? origin : perType;
        desired.set(t.__name, { type: t, path });
      }

      for (const { type, path } of desired.values()) {
        await writeAtomic(path, JSON.stringify(type, null, 2) + '\n');
      }

      const writtenPaths = new Set([...desired.values()].map((d) => d.path));

      // Remove per-type files for deleted types.
      for (const [name, origin] of originByName) {
        if (desired.has(name)) continue;
        if (!sharedFiles.has(origin) && !writtenPaths.has(origin)) {
          await unlink(origin).catch(() => undefined);
        }
      }
      // Remove now-migrated shared/legacy files.
      for (const shared of sharedFiles) {
        if (!writtenPaths.has(shared)) await unlink(shared).catch(() => undefined);
      }

      originByName = new Map(
        [...desired.entries()].map(([name, d]) => [name, d.path])
      );
      sharedFiles = new Set();
    },

    async readData(): Promise<Entry[] | null> {
      return readJson<Entry[]>(config.dataFile);
    },
    async writeData(entries: Entry[]): Promise<void> {
      await writeAtomic(config.dataFile, JSON.stringify(entries, null, 2) + '\n');
    },

    async readUsers(): Promise<User[] | null> {
      return readJson<User[]>(config.usersFile);
    },
    async writeUsers(users: User[]): Promise<void> {
      await writeAtomic(config.usersFile, JSON.stringify(users, null, 2) + '\n');
    },

    async readMediaIndex(): Promise<MediaItem[]> {
      return (await readJson<MediaItem[]>(mediaIndexFile)) ?? [];
    },
    async writeMediaIndex(items: MediaItem[]): Promise<void> {
      await writeAtomic(mediaIndexFile, JSON.stringify(items, null, 2) + '\n');
    },
    async writeMediaFile(filename: string, bytes: Uint8Array): Promise<void> {
      await writeAtomic(join(config.mediaDir, filename), bytes);
    },
    async readMediaFile(filename: string): Promise<Uint8Array> {
      return new Uint8Array(await readFile(join(config.mediaDir, filename)));
    },
    async deleteMediaFile(filename: string): Promise<void> {
      await unlink(join(config.mediaDir, filename)).catch((err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      });
    },
  };
}

/** In-memory StoragePort for tests and ephemeral use. */
export function createMemoryStoragePort(seed?: {
  schema?: Schema;
  data?: Entry[];
  media?: MediaItem[];
  users?: User[];
  files?: Record<string, Uint8Array>;
}): StoragePort {
  let schema: Schema | null = seed?.schema ?? null;
  let data: Entry[] | null = seed?.data ?? null;
  let media: MediaItem[] = seed?.media ?? [];
  let users: User[] | null = seed?.users ?? null;
  const files: Record<string, Uint8Array> = { ...(seed?.files ?? {}) };
  const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
  return {
    async readSchema() {
      return clone(schema);
    },
    async writeSchema(s) {
      schema = clone(s);
    },
    async readData() {
      return clone(data);
    },
    async writeData(d) {
      data = clone(d);
    },
    async readUsers() {
      return clone(users);
    },
    async writeUsers(u) {
      users = clone(u);
    },
    async readMediaIndex() {
      return clone(media);
    },
    async writeMediaIndex(items) {
      media = clone(items);
    },
    async writeMediaFile(filename, bytes) {
      files[filename] = bytes;
    },
    async readMediaFile(filename) {
      const f = files[filename];
      if (!f) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return f;
    },
    async deleteMediaFile(filename) {
      delete files[filename];
    },
  };
}
