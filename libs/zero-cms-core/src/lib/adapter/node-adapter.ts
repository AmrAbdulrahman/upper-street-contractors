/** Node adapter: an in-process Engine exposed through the Adapter interface. */

import { Engine } from '../engine/engine';
import { createFsStoragePort, createFsBlobStore } from '../engine/fs-storage-port';
import {
  createRedisStoragePort,
  createVercelBlobStore,
  type RedisStorageOptions,
  type VercelBlobOptions,
} from '../engine/redis-storage-port';
import type { StoragePort, BlobStore } from '../engine/storage-port';
import { resolveConfig, type ZeroCmsConfig } from '../config/config';
import type { Adapter } from './adapter';

export interface EngineAdapter extends Adapter {
  /** The underlying Engine (used by codegen, watch, and the reference server). */
  readonly engine: Engine;
}

/** Wrap any Engine (fs- or Redis-backed) as an Adapter — 1:1 pass-through. */
export function createEngineAdapter(engine: Engine): EngineAdapter {
  return {
    engine,
    getSchema: async () => engine.getSchema(),
    getSchemaVersion: () => engine.getSchemaVersion(),
    saveSchema: (schema, actor, expectedVersion, backfill) =>
      engine.saveSchema(schema, actor, expectedVersion, backfill),
    create: (t, v, actor) => engine.create(t, v, actor),
    update: (t, id, v, actor, expected) => engine.update(t, id, v, actor, expected),
    patch: (t, id, v, actor, expected) => engine.patch(t, id, v, actor, expected),
    delete: (t, id, actor, expected) => engine.delete(t, id, actor, expected),
    publish: (t, id, actor, expected) => engine.publish(t, id, actor, expected),
    unpublish: (t, id, actor, expected) => engine.unpublish(t, id, actor, expected),
    discardDraft: (t, id, actor, expected) => engine.discardDraft(t, id, actor, expected),
    get: async (t, id, opts) => engine.get(t, id, opts),
    query: async (t, input) => engine.query(t, input),
    listDrafts: async () => engine.listDrafts(),
    validateRefs: async (t, id) => engine.validateRefs(t, id),
    locate: async (id) => engine.locate(id),
    listMedia: async () => engine.listMedia(),
    putMedia: (bytes, meta, actor) => engine.putMedia(bytes, meta, actor),
    updateMedia: (id, meta, actor, expected) =>
      engine.updateMediaMeta(id, meta, actor, expected),
    getMedia: (id) => engine.getMedia(id),
    deleteMedia: (id, actor, expected) => engine.deleteMedia(id, actor, expected),
  };
}

/**
 * Build a filesystem-backed adapter from a base directory (default config).
 * Local dev / tests only — the deployed reference server uses the Redis-backed
 * adapter (ADR 0008); this keeps existing local tooling working unchanged.
 */
export async function createNodeFsAdapter(baseDir: string): Promise<EngineAdapter> {
  return createAdapterFromConfig(resolveConfig({}, baseDir));
}

/** Build a filesystem-backed adapter from a resolved {@link ZeroCmsConfig}. */
export async function createAdapterFromConfig(
  config: ZeroCmsConfig
): Promise<EngineAdapter> {
  return createNodeAdapter(createFsStoragePort(config), createFsBlobStore(config));
}

/** Build a node adapter from any StoragePort + BlobStore (e.g. in-memory for tests). */
export async function createNodeAdapter(
  port: StoragePort,
  blobs: BlobStore
): Promise<EngineAdapter> {
  const engine = await Engine.load(port, blobs);
  return createEngineAdapter(engine);
}

/**
 * Build the real deployed adapter — Redis (Upstash) + Vercel Blob (ADR 0008).
 * This is what `cms`'s reference server actually runs in every environment
 * (there's no separate "production config" the way the fs adapter needed one).
 */
export async function createRedisAdapter(
  redis: RedisStorageOptions,
  blob: VercelBlobOptions
): Promise<EngineAdapter> {
  return createNodeAdapter(createRedisStoragePort(redis), createVercelBlobStore(blob));
}
