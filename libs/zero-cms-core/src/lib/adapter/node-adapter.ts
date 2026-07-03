/** Node adapter: an in-process Engine exposed through the Adapter interface. */

import { Engine } from '../engine/engine';
import { createFsStoragePort } from '../engine/fs-storage-port';
import type { StoragePort } from '../engine/storage-port';
import { resolveConfig, type ZeroCmsConfig } from '../config/config';
import type { Adapter } from './adapter';

export interface EngineAdapter extends Adapter {
  /** The underlying Engine (used by codegen, watch, and the reference server). */
  readonly engine: Engine;
}

/** Wrap any Engine (fs- or memory-backed) as an Adapter. */
export function createEngineAdapter(engine: Engine): EngineAdapter {
  return {
    engine,
    getSchema: async () => engine.getSchema(),
    saveSchema: (schema) => engine.saveSchema(schema),
    create: (t, v) => engine.create(t, v),
    update: (t, id, v) => engine.update(t, id, v),
    patch: (t, id, v) => engine.patch(t, id, v),
    delete: (t, id) => engine.delete(t, id),
    publish: (t, id) => engine.publish(t, id),
    unpublish: (t, id) => engine.unpublish(t, id),
    discardDraft: (t, id) => engine.discardDraft(t, id),
    get: async (t, id, opts) => engine.get(t, id, opts),
    query: async (t, input) => engine.query(t, input),
    validateRefs: async (t, id) => engine.validateRefs(t, id),
    locate: async (id) => engine.locate(id),
    listMedia: async () => engine.listMedia(),
    putMedia: (bytes, meta) => engine.putMedia(bytes, meta),
    updateMedia: (id, meta) => engine.updateMediaMeta(id, meta),
    getMedia: (id) => engine.getMedia(id),
    deleteMedia: (id) => engine.deleteMedia(id),
  };
}

/** Build a filesystem-backed adapter from a base directory (default config). */
export async function createNodeFsAdapter(baseDir: string): Promise<EngineAdapter> {
  return createAdapterFromConfig(resolveConfig({}, baseDir));
}

/** Build a filesystem-backed adapter from a resolved {@link ZeroCmsConfig}. */
export async function createAdapterFromConfig(
  config: ZeroCmsConfig
): Promise<EngineAdapter> {
  return createNodeAdapter(createFsStoragePort(config));
}

/** Build a node adapter from any StoragePort (e.g. in-memory for tests). */
export async function createNodeAdapter(port: StoragePort): Promise<EngineAdapter> {
  const engine = await Engine.load(port);
  return createEngineAdapter(engine);
}
