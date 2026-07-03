/**
 * zero-cms-core — node entry. Re-exports the universal API plus the node-only
 * pieces that touch `fs`/`crypto`: the Engine, storage ports, node adapter,
 * codegen writer/watcher, and the reference server handler.
 */

export * from './index';

// Engine + storage
export { Engine } from './lib/engine/engine';
export type { StoragePort } from './lib/engine/storage-port';
export {
  createFsStoragePort,
  createMemoryStoragePort,
} from './lib/engine/fs-storage-port';

// Config
export {
  loadConfig,
  resolveConfig,
  findConfigFile,
  DEFAULT_CONFIG,
  type ZeroCmsConfig,
  type ZeroCmsUserConfig,
} from './lib/config/config';

// Node adapter
export {
  createNodeFsAdapter,
  createAdapterFromConfig,
  createNodeAdapter,
  createEngineAdapter,
  type EngineAdapter,
} from './lib/adapter/node-adapter';

// Codegen writer + watcher
export {
  generate,
  generateFromConfig,
  generateFromDir,
  writeGeneratedClient,
  type GenerateOptions,
} from './lib/codegen/write';
export {
  watchSchema,
  watchFromConfig,
  type WatchHandle,
  type WatchOptions,
} from './lib/codegen/watch';

// Reference server
export {
  createRequestHandler,
  type RequestHandlerOptions,
} from './lib/server/handler';

// Strapi migration
export {
  migrateStrapiSchemas,
  strapiSchemaToZeroCms,
  type StrapiContentType,
  type StrapiAttribute,
  type MigrationResult,
} from './lib/migrate/strapi';

// Auth
export {
  Auth,
  type AuthOptions,
  type CreateUserInput,
  type UpdateUserInput,
} from './lib/engine/auth/auth';
export { hashPassword, verifyPassword } from './lib/engine/auth/password';
export { signToken, verifyToken, type TokenPayload } from './lib/engine/auth/token';
export { createAuthHandler, type AuthOp } from './lib/server/auth-handler';
export { authorizeRpc, getBearer } from './lib/server/authorize';
