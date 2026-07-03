/**
 * HTTP adapter: forwards Adapter calls to the reference server (ADR 0004).
 * Browser apps inject this; it carries no `fs` and no Engine.
 */

import type { Schema } from '../model/schema';
import type { EntryValues } from '../model/entry';
import type { GetOptions, QueryInput, QueryResult } from '../model/query';
import type { MediaItem } from '../model/media';
import type { OutputEntry } from '../engine/output';
import { ZeroCmsError, type ZeroCmsErrorCode } from '../model/errors';
import type { Adapter, DanglingRef, MediaUpload, MediaMetaUpdate } from './adapter';
import { RPC_PATH, type RpcErrorBody, type RpcOp } from './protocol';
import { base64ToBytes, bytesToBase64 } from './base64';

export interface HttpAdapterOptions {
  /** Base URL of the host serving the reference handler, e.g. `/api` or `https://cms`. */
  baseUrl: string;
  /** Optional fetch override / headers (auth). */
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export function createHttpAdapter(opts: HttpAdapterOptions): Adapter {
  const doFetch = opts.fetch ?? fetch;
  const url = opts.baseUrl.replace(/\/$/, '') + RPC_PATH;

  async function rpc<T>(op: RpcOp, args: unknown[]): Promise<T> {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: JSON.stringify({ op, args }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as RpcErrorBody | null;
      const err = body?.error;
      throw new ZeroCmsError(
        (err?.code as ZeroCmsErrorCode) ?? 'CONFLICT',
        err?.message ?? `Request failed (${res.status})`,
        err?.details
      );
    }
    return (await res.json()) as T;
  }

  return {
    getSchema: () => rpc('getSchema', []),
    saveSchema: (schema: Schema) => rpc('saveSchema', [schema]),
    create: (t, v: EntryValues) => rpc('create', [t, v]),
    update: (t, id, v: EntryValues) => rpc('update', [t, id, v]),
    patch: (t, id, v: EntryValues) => rpc('patch', [t, id, v]),
    delete: (t, id) => rpc('delete', [t, id]),
    publish: (t, id) => rpc('publish', [t, id]),
    unpublish: (t, id) => rpc('unpublish', [t, id]),
    discardDraft: (t, id) => rpc('discardDraft', [t, id]),
    get: (t, id, opts?: GetOptions) =>
      rpc<OutputEntry | null>('get', [t, id, opts ?? {}]),
    query: (t, input?: QueryInput) =>
      rpc<QueryResult<OutputEntry>>('query', [t, input ?? {}]),
    validateRefs: (t, id) => rpc<DanglingRef[]>('validateRefs', [t, id]),
    locate: (id) => rpc<{ id: string; type: string } | null>('locate', [id]),
    listMedia: () => rpc<MediaItem[]>('listMedia', []),
    async putMedia(bytes: Uint8Array, meta: MediaUpload) {
      return rpc<MediaItem>('putMedia', [bytesToBase64(bytes), meta]);
    },
    updateMedia: (id: string, meta: MediaMetaUpdate) =>
      rpc<MediaItem>('updateMedia', [id, meta]),
    async getMedia(id: string) {
      const r = await rpc<{ item: MediaItem; bytesBase64: string }>('getMedia', [id]);
      return { item: r.item, bytes: base64ToBytes(r.bytesBase64) };
    },
    deleteMedia: (id) => rpc('deleteMedia', [id]),
  };
}
