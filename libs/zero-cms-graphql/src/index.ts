/**
 * @usc/zero-cms-graphql — the opt-in GraphQL layer (ADR 0005). Generates a GraphQL
 * schema (SDL + resolvers) from a CMS Schema and serves it with the same Adapter
 * that backs the generated stores. Core stays GraphQL-agnostic.
 */

export { generateSdl } from './lib/sdl';
export { buildResolvers, type BuildArgs } from './lib/resolvers';
export { buildCmsSchema, type BuildSchemaArgs } from './lib/schema';
export {
  createGraphQLHandler,
  type GraphQLHandlerOptions,
} from './lib/handler';
export { computePopulate } from './lib/populate';
