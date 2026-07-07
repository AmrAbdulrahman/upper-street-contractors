/**
 * Redis-backed StoragePort (Upstash) + Vercel Blob-backed BlobStore — the
 * deployed reference server's real backend (ADR 0008). Per-record keys, one
 * Lua `EVAL` script for every CAS write (ADR 0009) — verified against a real
 * Upstash instance to actually close the race, not just narrow it (Drive's
 * API had no equivalent primitive — see ADR 0008's considered options).
 *
 * Key layout, all namespaced under `zero-cms:` in case this Redis instance is
 * ever shared with something else (caching, rate limiting, ...):
 *   zero-cms:schema                    — one JSON document (ADR 0011)
 *   zero-cms:entry:<id>                — one Entry
 *   zero-cms:entries:<type>            — Set of entry ids of that type
 *   zero-cms:drafts                    — Set of entry ids with a pending draft,
 *                                         across all Types (maintained on every
 *                                         entry write, not derived by scanning —
 *                                         see listDraftEntryIds)
 *   zero-cms:user:<id>                 — one User
 *   zero-cms:user-email:<lowercased>   — id, for readUserByEmail
 *   zero-cms:users                     — Set of all user ids
 *   zero-cms:media:<id>                — one MediaItem
 *   zero-cms:media-ids                 — Set of all media ids
 */

import { Redis } from '@upstash/redis';
import { put as blobPut, del as blobDel } from '@vercel/blob';
import type { StoragePort, SchemaRecord, BlobStore } from './storage-port';
import type { Schema } from '../model/schema';
import type { Entry } from '../model/entry';
import type { MediaItem } from '../model/media';
import type { User } from '../model/user';

const PREFIX = 'zero-cms:';
const k = {
  schema: `${PREFIX}schema`,
  entry: (id: string) => `${PREFIX}entry:${id}`,
  entriesOfType: (type: string) => `${PREFIX}entries:${type}`,
  drafts: `${PREFIX}drafts`,
  user: (id: string) => `${PREFIX}user:${id}`,
  userEmail: (email: string) => `${PREFIX}user-email:${email.trim().toLowerCase()}`,
  users: `${PREFIX}users`,
  media: (id: string) => `${PREFIX}media:${id}`,
  mediaIds: `${PREFIX}media-ids`,
};

/** Keep the `drafts` index in sync with a single entry's own draft state. */
async function syncDraftIndex(redis: Redis, entry: Entry): Promise<void> {
  if (entry.__draft !== null) await redis.sadd(k.drafts, entry.__id);
  else await redis.srem(k.drafts, entry.__id);
}

/**
 * Generic CAS: read the key, compare `decoded[versionField]` against
 * `expected` (a Lua `false`/nil argument means "must not exist yet" — used
 * only by schema's first save), and only then overwrite. Atomic — Redis runs
 * the whole script as one indivisible operation, no TOCTOU gap between our
 * check and our write (unlike Google Drive's API — no such primitive there).
 */
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local versionField = ARGV[1]
local expected = ARGV[2]
local nextValue = ARGV[3]
if current then
  local decoded = cjson.decode(current)
  local currentVersion = tostring(decoded[versionField])
  if currentVersion ~= expected then
    return nil
  end
else
  if expected ~= 'null' then
    return nil
  end
end
redis.call('SET', KEYS[1], nextValue)
return nextValue
`;

export interface RedisStorageOptions {
  url: string;
  token: string;
}

export function createRedisStoragePort(opts: RedisStorageOptions): StoragePort {
  const redis = new Redis({ url: opts.url, token: opts.token });

  async function cas<T>(
    key: string,
    versionField: string,
    expected: string | null,
    next: T
  ): Promise<T | null> {
    const result = await redis.eval(
      CAS_SCRIPT,
      [key],
      [versionField, expected ?? 'null', JSON.stringify(next)]
    );
    if (result == null) return null;
    // The Upstash client auto-deserializes JSON-looking string results (same as
    // GET) — only parse if it actually came back as a raw string.
    return (typeof result === 'string' ? JSON.parse(result) : result) as T;
  }

  return {
    async readSchema() {
      return (await redis.get<SchemaRecord>(k.schema)) ?? null;
    },
    async writeSchema(schema: Schema, expectedVersion: string | null) {
      const current = await redis.get<SchemaRecord>(k.schema);
      const record: SchemaRecord = {
        schema,
        version: new Date().toISOString(),
        lastEditedBy: current?.lastEditedBy ?? 'system',
      };
      return cas(k.schema, 'version', expectedVersion, record);
    },

    async readEntry(id) {
      return (await redis.get<Entry>(k.entry(id))) ?? null;
    },
    async listEntryIds(type) {
      return (await redis.smembers(k.entriesOfType(type))) as string[];
    },
    async readEntries(ids) {
      if (ids.length === 0) return [];
      const values = await redis.mget<Entry[]>(...ids.map(k.entry));
      return values.filter((e): e is Entry => e !== null);
    },
    /**
     * Every entry across all Types with a pending draft — reads the
     * maintained index (one Set), not a per-Type scan. Was previously done by
     * the editor bar issuing a separate query() per Type in the schema (2
     * round trips each) purely to compute this count; the index turns the
     * whole thing into 2 round trips total, regardless of schema size.
     */
    async listDraftEntryIds() {
      return (await redis.smembers(k.drafts)) as string[];
    },
    async createEntry(entry) {
      await Promise.all([
        redis.set(k.entry(entry.__id), entry),
        redis.sadd(k.entriesOfType(entry.__type), entry.__id),
        syncDraftIndex(redis, entry),
      ]);
    },
    async writeEntry(id, expectedLastEditedAt, next) {
      const written = await cas(k.entry(id), '__lastEditedAt', expectedLastEditedAt, next);
      if (written === null) return false;
      await syncDraftIndex(redis, written);
      return true;
    },
    async deleteEntry(id, expectedLastEditedAt) {
      const current = await redis.get<Entry>(k.entry(id));
      if (!current || current.__lastEditedAt !== expectedLastEditedAt) return false;
      await Promise.all([
        redis.del(k.entry(id)),
        redis.srem(k.entriesOfType(current.__type), id),
        redis.srem(k.drafts, id),
      ]);
      return true;
    },

    async readUser(id) {
      return (await redis.get<User>(k.user(id))) ?? null;
    },
    async readUserByEmail(email) {
      const id = await redis.get<string>(k.userEmail(email));
      return id ? ((await redis.get<User>(k.user(id))) ?? null) : null;
    },
    async listUserIds() {
      return (await redis.smembers(k.users)) as string[];
    },
    async createUser(user) {
      await Promise.all([
        redis.set(k.user(user.__id), user),
        redis.set(k.userEmail(user.email), user.__id),
        redis.sadd(k.users, user.__id),
      ]);
    },
    async writeUser(id, expectedUpdatedAt, next) {
      const current = await redis.get<User>(k.user(id));
      const written = await cas(k.user(id), 'updatedAt', expectedUpdatedAt, next);
      if (!written) return false;
      // Email index follows the user record — best-effort, not itself CAS'd
      // (a concurrent email change racing this exact write is vanishingly
      // unlikely and low-stakes; see ADR 0008's accepted-narrow-window stance).
      if (current && current.email.toLowerCase() !== next.email.toLowerCase()) {
        await Promise.all([
          redis.del(k.userEmail(current.email)),
          redis.set(k.userEmail(next.email), id),
        ]);
      }
      return true;
    },
    async deleteUser(id, expectedUpdatedAt) {
      const current = await redis.get<User>(k.user(id));
      if (!current || current.updatedAt !== expectedUpdatedAt) return false;
      await Promise.all([
        redis.del(k.user(id)),
        redis.del(k.userEmail(current.email)),
        redis.srem(k.users, id),
      ]);
      return true;
    },

    async readMediaItem(id) {
      return (await redis.get<MediaItem>(k.media(id))) ?? null;
    },
    async listMediaIds() {
      return (await redis.smembers(k.mediaIds)) as string[];
    },
    async createMediaItem(item) {
      await Promise.all([
        redis.set(k.media(item.id), item),
        redis.sadd(k.mediaIds, item.id),
      ]);
    },
    async writeMediaItem(id, expectedUpdatedAt, next) {
      const written = await cas(k.media(id), 'updatedAt', expectedUpdatedAt, next);
      return written !== null;
    },
    async deleteMediaItem(id, expectedUpdatedAt) {
      const current = await redis.get<MediaItem>(k.media(id));
      if (!current || current.updatedAt !== expectedUpdatedAt) return false;
      await Promise.all([redis.del(k.media(id)), redis.srem(k.mediaIds, id)]);
      return true;
    },
  };
}

export interface VercelBlobOptions {
  token: string;
}

/** Vercel Blob-backed BlobStore — media bytes (ADR 0008). */
export function createVercelBlobStore(opts: VercelBlobOptions): BlobStore {
  return {
    async put(key, bytes, contentType) {
      const { url } = await blobPut(key, Buffer.from(bytes), {
        access: 'public',
        contentType,
        token: opts.token,
        // Two uploads can't collide on a key anyway (ids are unique per
        // upload, per Engine.putMedia) — this just keeps the key literal.
        addRandomSuffix: false,
      });
      return { url };
    },
    async get(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Blob fetch failed (${res.status}): ${url}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async delete(url) {
      await blobDel(url, { token: opts.token });
    },
  };
}
