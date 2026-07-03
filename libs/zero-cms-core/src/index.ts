/**
 * zero-cms-core — universal (browser-safe) entry.
 *
 * Everything here is free of `node:` imports, so React apps (zero-cms-app /
 * zero-cms-widget) and generated clients can import it in the browser.
 * Node-only pieces (Engine, fs storage, codegen writer, server) live in the
 * `@usc/zero-cms-core/node` entry.
 */

// Model
export * from './lib/model/schema';
export * from './lib/model/entry';
export * from './lib/model/query';
export * from './lib/model/media';
export * from './lib/model/errors';
export * from './lib/model/user';

// Output materialization (pure)
export {
  buildOutput,
  resolveOutput,
  type OutputEntry,
  type ResolveCtx,
} from './lib/engine/output';

// Client
export { bindStore, type Store } from './lib/client/store';

// Adapter contract + http transport
export type { Adapter, DanglingRef, MediaUpload } from './lib/adapter/adapter';
export {
  createHttpAdapter,
  type HttpAdapterOptions,
} from './lib/adapter/http-adapter';
export {
  RPC_PATH,
  type RpcOp,
  type RpcRequest,
  type RpcErrorBody,
} from './lib/adapter/protocol';
export { bytesToBase64, base64ToBytes } from './lib/adapter/base64';

// Codegen (pure source generation — no fs)
export { generateClientSource } from './lib/codegen/generate';
export { pascalCase, camelCase } from './lib/codegen/naming';
